/* eslint-disable camelcase */

// node modules
import { inspect } from 'util'

// packages
import core from '@actions/core'
import github from '@actions/github'

export default async function ({ octokit, workflow_id, run_id, before, regex }) {
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
  
      const crucial_jobs = jobs
        // limit to current running jobs
        .filter(job => ['in_progress'].includes(job.status))
        // limit to these 3 jobs
        .filter(job => job.name.match(regex))

        core.info(`found ${crucial_jobs.length} jobs matching regex: ${regex} `)
        core.debug(inspect(crucial_jobs.map(run => ({ id: run.id, name: run.name }))))
      return crucial_jobs
    });

  core.info(`found ${waiting_for.length} workflow runs`)
  core.debug(inspect(waiting_for.map(run => ({ id: run.id, name: run.name }))))

  return waiting_for
}
