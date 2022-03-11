import { CronJob } from 'cron';
import Moment from 'moment';
import axios from 'axios';

const PARSE_TIMEZONE = 'UTC';
let cronJobs: { [id: string]: CronJob } = {};

// https://medium.com/javascript-everyday/singleton-made-easy-with-typescript-6ad55a7ba7ff
class JobScheduler {

  private _parseApp: typeof Parse;
  private static instances: Map<string, JobScheduler> = new Map<string, JobScheduler>;

  private constructor(parseApp: typeof Parse){
      this._parseApp = parseApp;
  };

  static getInstance(parseApp: typeof Parse | undefined): JobScheduler {
    if (parseApp == undefined) parseApp = Parse;
    if (parseApp == undefined || !parseApp.applicationId)
      throw new Error('Parse is not initialized!');
    if (!JobScheduler.instances.has(parseApp.applicationId)) {
        JobScheduler.instances.set(parseApp.applicationId, new JobScheduler(parseApp));
        let newScheduler = JobScheduler.instances.get(parseApp.applicationId)!;
        // Init jobs on server launch
        newScheduler.recreateScheduleForAllJobs();
    
        // CLOUD: Recreates schedule when a job schedule has changed
        newScheduler._parseApp.Cloud.afterSave('_JobSchedule', async (request) => {
          newScheduler.recreateSchedule(request.object.id)
        });
      
        // CLOUD: Destroy schedule for removed job
        newScheduler._parseApp.Cloud.afterDelete('_JobSchedule', async (request) => {
            newScheduler.destroySchedule(request.object.id)
        });
    
        console.log("parse-server-job-scheduler: JobScheduler initialized.")
    }
    return JobScheduler.instances.get(parseApp.applicationId)!;
}

  public recreateScheduleForAllJobs() {
    if (!(this._parseApp.applicationId)) throw new Error('Parse is not initialized!');
    const query = new this._parseApp.Query('_JobSchedule');
    query.find({ useMasterKey: true })
      .then((jobSchedules: Parse.Object[]) => {
        let recreatedJobs = 0;
        this.destroySchedules();
        jobSchedules.forEach((jobSchedule: Parse.Object) => {
          try {
            this.recreateJobSchedule(jobSchedule);
            recreatedJobs += 1;
          } catch (error) {
            console.log(error);
          }
        });
        console.log(`parse-server-job-scheduler: Recreated ${recreatedJobs} job${(recreatedJobs == 1) ? "" : "s"} successfully.`)
      });
  }

  public destroySchedules() {
    for (const id of Object.keys(cronJobs)) {
      this.destroySchedule(id);
    }

    cronJobs = {};
  }

  public recreateSchedule(jobId: string) {
    if (!(this._parseApp.applicationId)) throw new Error('Parse is not initialized!');
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
    if (!(this._parseApp.applicationId)) throw new Error('Parse is not initialized!');
    axios.post(this._parseApp.serverURL + '/jobs/' + jobName, params, {
      headers: {
        'X-Parse-Application-Id': this._parseApp.applicationId,
        'X-Parse-Master-Key': this._parseApp.masterKey ?? "",
      },
    }).then(() => {
      console.log(`Job ${jobName} launched.`);
    }).catch((error: any) => {
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

module.exports = function(parseApp: typeof Parse | undefined){
    return JobScheduler.getInstance(parseApp);
}
