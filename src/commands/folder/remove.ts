import SASjs from '@sasjs/adapter/node'
import { displayResult } from '../../utils/displayResult'

/**
 * Deletes folder.
 * @param {string} path - folder path.
 * @param {object} sasjs - configuration object of SAS adapter.
 * @param {string} accessToken - an access token for an authorized user.
 */
export const remove = async (
  path: string,
  sasjs: SASjs,
  accessToken: string
) => {
  const deletedFolder = await sasjs
    .deleteFolder(path, accessToken)
    .catch((err) => {
      displayResult(err)
    })

  if (deletedFolder) {
    displayResult(
      null,
      null,
      `Folder '${path}' has been moved to 'Recycle Bin'.`
    )
    return Promise.resolve(true)
  }
  return Promise.reject()
}
