import { Target } from '@sasjs/utils'
import path from 'path'
import { getConstants } from '../../../constants'
import { getLocalOrGlobalConfig } from '../../../utils/config'

export async function getAllJobFolders(target: Target) {
  const { buildSourceFolder } = await getConstants()
  const { configuration } = await getLocalOrGlobalConfig()
  let allJobs: string[] = []

  if (configuration?.jobConfig?.jobFolders)
    allJobs = [...configuration.jobConfig.jobFolders]

  if (target?.jobConfig?.jobFolders)
    allJobs = [...allJobs, ...target.jobConfig.jobFolders]

  allJobs = allJobs.filter((s) => !!s) as string[]
  return [...new Set(allJobs)]
}
