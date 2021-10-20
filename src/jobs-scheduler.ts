import { CronJob } from 'cron';
import Moment from 'moment';
import axios from 'axios';

const PARSE_TIMEZONE = 'UTC';
let cronJobs: { [id: string]: CronJob } = {};

export default class JobsScheduler {

  public _parseApp: typeof Parse;

  constructor(parseApp: typeof Parse){
      this._parseApp = parseApp;
      // Init jobs on server launch
      this.recreateScheduleForAllJobs();
  }

  public recreateScheduleForAllJobs() {
    if (!this._parseApp.applicationId) {
      throw new Error('Parse is not initialized');
    }

    let recreatedJobs = 0;
    const query = new this._parseApp.Query('_JobSchedule');
    query.find({ useMasterKey: true })
      .then((jobSchedules: Parse.Object[]) => {
        this.destroySchedules();

        // TODO: Fix any
        jobSchedules.forEach((jobSchedule: Parse.Object) => {
          try {
            this.recreateJobSchedule(jobSchedule);
            recreatedJobs += 1;
          } catch (error) {
            console.log(error);
          }
        });
      });
      console.log(`parse-server-jobs-scheduler: Recreated ${recreatedJobs} job${(recreatedJobs == 1) ? "" : "s"} successfully.`)
  }

  public destroySchedules() {
    for (const id of Object.keys(cronJobs)) {
      this.destroySchedule(id);
    }

    cronJobs = {};
  }

  public recreateSchedule(jobId: string) {
    if (!this._parseApp.applicationId) {
      throw new Error('Parse is not initialized');
    }
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
    if (!this._parseApp.applicationId) {
      throw new Error('Parse is not initialized');
    }
    axios.post(this._parseApp.serverURL + '/jobs/' + jobName, params, {
      headers: {
        'X-Parse-Application-Id': this._parseApp.applicationId,
        'X-Parse-Master-Key': this._parseApp.masterKey ?? "",
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
