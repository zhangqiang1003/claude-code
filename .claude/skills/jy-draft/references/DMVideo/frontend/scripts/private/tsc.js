const ChildProcess = require('child_process');
const Chalk = require('chalk');

function compile(directory) {
  return new Promise((resolve, reject) => {
    const tscProcess = ChildProcess.spawn('npx', ['tsc'], {
      cwd: directory,
      shell: true,
      stdio: 'inherit'
    });

    tscProcess.on('error', (err) => {
      console.error(Chalk.red(`[tsc] Error: ${err.message}`));
      reject(err);
    });

    tscProcess.on('exit', (exitCode) => {
      if (exitCode > 0) {
        console.error(Chalk.red(`[tsc] Exit code: ${exitCode}`));
        reject(new Error(`tsc exited with code ${exitCode}`));
      } else {
        console.log(Chalk.greenBright(`[tsc] Compiled successfully`));
        resolve();
      }
    });
  });
}

module.exports = compile;
