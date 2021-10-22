# Parse Server Job Scheduler

Forked from [LcpMarvel/parse-server-jobs-scheduler](https://github.com/LcpMarvel/parse-server-jobs-scheduler)

Available on [GitHub](https://github.com/LMBernardo/parse-server-job-scheduler) and [npm](https://www.npmjs.com/package/parse-server-job-scheduler)
## Notes
* It's better to use [cron jobs](https://docs.parseplatform.org/cloudcode/guide/#scheduling-a-job) instead of using this library.
* You have to handle any concurrency issues. This plugin is run by Parse Server's workers if cluster is true.
* This library REQUIRES Parse cloud code to be set up and functional.
* Parse must be initialized before creating the scheduler.
## How to use it?

### Install the library

```sh
$ npm install parse-server-job-scheduler --save
```
### Add the following lines in your Cloud code main.js file, or in a file included by main.js

```js
try {
    var scheduler = require('parse-server-job-scheduler');
    scheduler();
} catch (err) {
    console.error("Error: " + err);
    console.error("Failed to set up job scheduling!");
}
```

# Disclaimer
Please read the [**LICENSE**](./LICENSE).

This library is **NOT** fully tested and is **NOT** guaranteed to work well, or at all. I am not responsible for anything resulting from the use, or misuse, of this library.

Github [issues](https://github.com/LMBernardo/parse-server-job-scheduler/issues/new) and [pull requests](https://github.com/LMBernardo/parse-server-job-scheduler/pulls) are welcome. 

Please email any questions or concerns to the author of this package, or open a [discussion](https://github.com/LMBernardo/parse-server-job-scheduler/discussions).