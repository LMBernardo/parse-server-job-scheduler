# Parse server jobs scheduler

## Note 
It's better to use [cron job](https://docs.parseplatform.org/cloudcode/guide/#scheduling-a-job) instead of using this library.
You have to handle the concurrency issue since this plugin is running by parse server's workers if cluster is true.

## How to use it?

### Install the library

```sh
$ npm install parse-server-jobs-scheduler --save
```

### Add those lines your Parse Cloud code main file

```js
require('parse-server-job-scheduler')(Parse);
```
