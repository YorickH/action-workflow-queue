/* eslint-disable camelcase */

// node modules
import { inspect } from 'util'

// packages
import core from '@actions/core'
import github from '@actions/github'

export default async function ({ octokit, workflow_id, run_id, before, crucial_jobs }) {
  // get current run of this workflow
  const { data: { workflow_runs } } = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
    ...github.context.repo,
    workflow_id
  })

  // find any instances of the same workflow
  const waiting_for = workflow_runs
    // limit to currently running ones
    .filter(run => ['in_progress'].includes(run.status))
    // exclude this one
    .filter(run => run.id !== run_id)
    // get older runs
    .filter(run => new Date(run.run_started_at) < before)
    .filter(async (run) => {
      // Make a separate Octokit request to get jobs for a specific run
      const { data: { jobs } } = await octokit.request('GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs', {
        ...github.context.repo,
        run_id: run.id
      });

      const crucialJobNames = crucial_jobs.split(",");

      core.info(inspect(jobs.map(job => ({ id: job.id, name: job.name, status: job.status }))))
  
      const crucialJobs = jobs.filter(job => job.status === 'in_progress' && crucialJobNames.startsWith(job.name));

      core.info(`✅ found ${crucialJobs.length} jobs found in list: ${crucialJobNames} `)
      core.info(inspect(crucialJobs.map(job => ({ id: job.id, name: job.name, status: job.status }))))

      return crucialJobs
    });

  core.debug(inspect(waiting_for.map(run => ({ id: run.id, name: run.name }))))

  return waiting_for
}
