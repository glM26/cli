import * as deployModule from '../deploy'
import { ServicePackCommand } from '../servicePackCommand'
import { Logger, LogLevel, ServerType, Target } from '@sasjs/utils'
import * as configUtils from '../../../utils/config'
import { ReturnCode } from '../../../types/command'
import { setConstants } from '../../../utils'

const defaultArgs = ['node', 'sasjs']
const target = new Target({
  name: 'test',
  appLoc: '/Public/test/',
  serverType: ServerType.SasViya,
  contextName: 'test context'
})
const source = 'path/to/json'
describe('ServicePackCommand', () => {
  beforeAll(async () => {
    await setConstants()
  })

  beforeEach(() => {
    setupMocks()
  })

  it('should parse sasjs servicepack deploy command', async () => {
    const args = [...defaultArgs, 'servicepack', 'deploy', '--source', source]

    const command = new ServicePackCommand(args)
    await command.execute()
    const targetInfo = await command.getTargetInfo()

    expect(command.name).toEqual('servicepack')
    expect(command.subCommand).toEqual('deploy')
    expect(targetInfo.target).toEqual(target)
    expect(targetInfo.isLocal).toBeTrue()

    expect(deployModule.servicePackDeploy).toHaveBeenCalledWith(
      target,
      source,
      false
    )
  })

  it('should parse sasjs servicepack deploy command with all arguments', async () => {
    const args = [
      ...defaultArgs,
      'servicepack',
      'deploy',
      '--target',
      'test',
      '--source',
      source,
      '--force'
    ]

    const command = new ServicePackCommand(args)
    await command.execute()
    const targetInfo = await command.getTargetInfo()

    expect(command.name).toEqual('servicepack')
    expect(command.subCommand).toEqual('deploy')
    expect(targetInfo.target).toEqual(target)
    expect(targetInfo.isLocal).toBeTrue()

    expect(deployModule.servicePackDeploy).toHaveBeenCalledWith(
      target,
      source,
      true
    )
  })

  it('should parse a sasjs servicepack deploy command with all shorthand arguments', async () => {
    const args = [
      ...defaultArgs,
      'servicepack',
      'deploy',
      '-t',
      'test',
      '-s',
      source,
      '-f'
    ]

    const command = new ServicePackCommand(args)
    await command.execute()
    const targetInfo = await command.getTargetInfo()

    expect(command.name).toEqual('servicepack')
    expect(command.subCommand).toEqual('deploy')
    expect(targetInfo.target).toEqual(target)
    expect(targetInfo.isLocal).toBeTrue()

    expect(deployModule.servicePackDeploy).toHaveBeenCalledWith(
      target,
      source,
      true
    )
  })

  it('should log success and return the success code when execution is successful', async () => {
    const args = [...defaultArgs, 'servicepack', 'deploy', '--source', source]

    const command = new ServicePackCommand(args)
    const returnCode = await command.execute()

    expect(returnCode).toEqual(ReturnCode.Success)
  })

  it('should log the error and return the error code when execution is unsuccessful', async () => {
    const args = [...defaultArgs, 'servicepack', 'deploy', '--source', source]
    jest
      .spyOn(deployModule, 'servicePackDeploy')
      .mockImplementation(() => Promise.reject(new Error('Test Error')))

    const command = new ServicePackCommand(args)
    const returnCode = await command.execute()

    expect(returnCode).toEqual(ReturnCode.InternalError)
    expect(process.logger.error).toHaveBeenCalled()
  })
})

const setupMocks = () => {
  jest.resetAllMocks()
  jest.mock('../deploy')
  jest.mock('../../../utils/config')
  jest
    .spyOn(deployModule, 'servicePackDeploy')
    .mockImplementation(() => Promise.resolve(undefined))

  jest
    .spyOn(configUtils, 'findTargetInConfiguration')
    .mockImplementation(() => Promise.resolve({ target, isLocal: true }))

  process.logger = new Logger(LogLevel.Off)
  jest.spyOn(process.logger, 'error')
}
