import { CronJob } from 'cron';
import Moment from 'moment';
import axios from 'axios';

const PARSE_TIMEZONE = 'UTC';
let cronJobs: { [id: string]: CronJob } = {};

// https://medium.com/javascript-everyday/singleton-made-easy-with-typescript-6ad55a7ba7ff
class JobScheduler {

  private _parseApp: typeof Parse;
  private static instance: JobScheduler;

  private constructor(parseApp: typeof Parse){
      this._parseApp = parseApp;
  };

  static getInstance(parseApp: typeof Parse): JobScheduler {
    if (!JobScheduler.instance) {
        JobScheduler.instance = new JobScheduler(parseApp);

        // Init jobs on server launch
        JobScheduler.instance.recreateScheduleForAllJobs();
    
        // CLOUD: Recreates schedule when a job schedule has changed
        JobScheduler.instance._parseApp.Cloud.afterSave('_JobSchedule', async (request) => {
            JobScheduler.instance.recreateSchedule(request.object.id)
        });
      
        // CLOUD: Destroy schedule for removed job
        JobScheduler.instance._parseApp.Cloud.afterDelete('_JobSchedule', async (request) => {
            JobScheduler.instance.destroySchedule(request.object.id)
        });
    
        console.log("parse-server-job-scheduler: JobScheduler initialized.")
    }
    return JobScheduler.instance;
}

  public recreateScheduleForAllJobs() {
    if (!(JobScheduler.instance._parseApp)) throw new Error('Parse is not initialized!');
    let recreatedJobs = 0;
    const query = new JobScheduler.instance._parseApp.Query('_JobSchedule');
    query.find({ useMasterKey: true })
      .then((jobSchedules: Parse.Object[]) => {
        this.destroySchedules();
        jobSchedules.forEach((jobSchedule: Parse.Object) => {
          try {
            this.recreateJobSchedule(jobSchedule);
            recreatedJobs += 1;
          } catch (error) {
            console.log(error);
          }
        });
      });
      console.log(`parse-server-job-scheduler: Recreated ${recreatedJobs} job${(recreatedJobs == 1) ? "" : "s"} successfully.`)
  }

  public destroySchedules() {
    for (const id of Object.keys(cronJobs)) {
      this.destroySchedule(id);
    }

    cronJobs = {};
  }

  public recreateSchedule(jobId: string) {
    if (!(JobScheduler.instance._parseApp)) throw new Error('Parse is not initialized!');
    this._parseApp.Object
      .extend('_JobSchedule')
      .createWithoutData(jobId)
      .fetch({ useMasterKey: true })
      .then((jobSchedule: Parse.Object) => {
        this.recreateJobSchedule(jobSchedule);
      });
  }

  public destroySchedule(jobId: string) {
    const cronJob = cronJobs[jobId];

    if (cronJob) {
      cronJob.stop();

      delete cronJobs[jobId];
    }
  }

  private recreateJobSchedule(job: Parse.Object) {
    this.destroySchedule(job.id);
    cronJobs[job.id] = this.createCronJob(job);
  }

  private createCronJob(jobSchedule: Parse.Object) {
    const startDate = new Date(jobSchedule.get('startAfter'));
    const repeatMinutes = jobSchedule.get('repeatMinutes');
    const jobName = jobSchedule.get('jobName');
    const params = jobSchedule.get('params');

    const performJob = () => this.performJob(jobName, params);

    // Launch just once
    if (!repeatMinutes) {
      return new CronJob(startDate, performJob, undefined, true, PARSE_TIMEZONE);
    }

    // Periodic job. Create a cron to launch the periodic job a the start date.
    return new CronJob(
      this.countCronTime(jobSchedule),
      performJob,
      undefined,
      true,
      PARSE_TIMEZONE,
    );
  }

  private performJob(jobName: string, params: any) {
    if (!(JobScheduler.instance._parseApp)) throw new Error('Parse is not initialized!');
    axios.post(JobScheduler.instance._parseApp.serverURL + '/jobs/' + jobName, params, {
      headers: {
        'X-Parse-Application-Id': JobScheduler.instance._parseApp.applicationId,
        'X-Parse-Master-Key': JobScheduler.instance._parseApp.masterKey ?? "",
      },
    }).then(() => {
      console.log(`Job ${jobName} launched.`);
    }).catch((error) => {
      console.log(error);
    });
  }

  private countCronTime(jobSchedule: Parse.Object) {
    const timeOfDay = Moment(jobSchedule.get('timeOfDay'), 'HH:mm:ss.Z').utc();
    const daysOfWeek = jobSchedule.get('daysOfWeek');
    const cronDoW = (daysOfWeek) ? this.daysOfWeekToCronString(daysOfWeek) : '*';

    const repeatMinutes = jobSchedule.get('repeatMinutes');
    const minutes = repeatMinutes % 60;
    const hours = Math.floor(repeatMinutes / 60);

    let cron = '0 ';
    // Minutes
    if (minutes) {
      cron += `${timeOfDay.minutes()}-59/${minutes} `;
    } else {
      cron += `0 `;
    }

    // Hours
    cron += `${timeOfDay.hours()}-23`;
    if (hours) {
      cron += `/${hours}`;
    }
    cron += ' ';

    // Day of month
    cron += '* ';

    // Month
    cron += '* ';

    // Days of week
    cron += cronDoW;

    return cron;
  }

  private daysOfWeekToCronString(daysOfWeek: number[]) {
    const daysNumbers = [];

    for (let i = 0; i < daysOfWeek.length; i++) {
      if (daysOfWeek[i]) {
        daysNumbers.push((i + 1) % 7);
      }
    }

    return daysNumbers.join(',');
  }
}

module.exports = function(parseApp: typeof Parse){
    return JobScheduler.getInstance(parseApp);
}
