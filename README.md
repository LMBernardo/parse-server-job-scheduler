# Parse server jobs scheduler

## Note 
It's better to use [cron jobs](https://docs.parseplatform.org/cloudcode/guide/#scheduling-a-job) instead of using this library.
You have to handle the concurrency issue since this plugin is running by parse server's workers if cluster is true.

## How to use it?

### Install the library

```sh
$ npm install parse-server-job-scheduler --save
```
npm sta
### Add the following lines in your Cloud code main.js file, or in a file included by main.js

```js
try {
    const jobScheduler = require('parse-server-job-scheduler');
    jobScheduler(Parse);
} catch (err){
    console.error(`Error: ${err}`);
    console.error(`Failed to set up job scheduling!`);
}
```
