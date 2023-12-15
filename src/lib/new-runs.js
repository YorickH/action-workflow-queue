/* eslint-disable camelcase */

// node modules
import { inspect } from 'util'

// packages
import core from '@actions/core'
import github from '@actions/github'

export default async function ({ octokit, workflow_id, run_id, after }) {
  // get current run of this workflow
  const { data: { workflow_runs } } = await octokit.request('GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs', {
    ...github.context.repo,
    workflow_id
  })

  // find any instances of the same workflow
  const cancelling_for = workflow_runs
    // limit to currently running ones
    .filter(run => ['in_progress', 'queued', 'waiting', 'pending', 'action_required', 'requested'].includes(run.status))
    // exclude this one
    .filter(run => run.id !== run_id)
    // get newer runs
    .filter(run => new Date(run.run_started_at) > after)

  core.info(`ℹ️ found ${cancelling_for.length} more recent workflow runs`)
  core.debug(inspect(cancelling_for.map(run => ({ id: run.id, name: run.name, run_started_at: run.run_started_at }))))

  // no workflow is running
  if (cancelling_for.length > 0) {
    // Function to generate a clickable link
    const addClickableLink = (link, text) => `\u001B]8;;${link}\u0007${text}\u001B]8;;\u0007`;

    // Create clickable links for each item in the list
    const urlsString = cancelling_for.map(workflow => addClickableLink(workflow.html_url, workflow.id)).join(', ');

    core.notice(`🛑 Cancelling this run because there is a more recent one running. More recent runs: ${urlsString}`)
    octokit.request('POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel', {
      ...github.context.repo,
      run_id
    })
    process.exit(0)
  }

}
