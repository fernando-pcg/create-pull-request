import * as core from '@actions/core'
import {
  createOrUpdateBranch,
  getWorkingBaseAndType,
  WorkingBaseType
} from './create-or-update-branch'
import {GitHubHelper} from './github-helper'
import {GitCommandManager} from './git-command-manager'
import {GitConfigHelper} from './git-config-helper'
import * as utils from './utils'

export async function createPullRequest(inputs: Inputs): Promise<void> {
  let gitConfigHelper, git
  try {
    core.startGroup('Prepare git configuration')
    const repoPath = utils.getRepoPath(inputs.path)
    git = await GitCommandManager.create(repoPath)
    gitConfigHelper = await GitConfigHelper.create(git)
    core.endGroup()

    core.startGroup('Determining the base and head repositories')
    const baseRemote = gitConfigHelper.getGitRemote()
    const ghPull = new GitHubHelper(baseRemote.hostname, inputs.token)
    core.endGroup()

    // Configurar autenticación
    if (baseRemote.protocol === 'HTTPS') {
      core.startGroup('Configuring credential for HTTPS authentication')
      await gitConfigHelper.configureToken(inputs.branchToken)
      core.endGroup()
    }

    core.startGroup('Checking the base repository state')
    const base = inputs.base ? inputs.base : await git.getCurrentBranch()
    core.info(`Working base is branch '${base}'`)
    core.endGroup()

    core.startGroup('Create the pull request directly from the existing branch')
    const pull = await ghPull.createOrUpdatePullRequest(
      inputs,
      baseRemote.repository,
      baseRemote.repository  // Usar el mismo repositorio como base y head
    )
    core.info(`Pull request created with number: ${pull.number}`)
    core.setOutput('pull-request-url', pull.html_url)
    core.setOutput('pull-request-number', pull.number.toString())
    core.endGroup()
  } catch (error) {
    core.setFailed(utils.getErrorMessage(error))
  } finally {
    core.startGroup('Restore git configuration')
    await gitConfigHelper.close()
    core.endGroup()
  }
}
