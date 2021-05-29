import { TestFlow, Coverage, CoverageType, CoverageState } from '../../../types'
import path from 'path'
import { getConstants } from '../../../constants'
import {
  createFile,
  copy,
  listFilesInFolder,
  fileExists,
  createFolder
} from '@sasjs/utils/file'
import { loadDependencies } from './loadDependencies'
import { sasFileRegExp } from '../../../utils/file'
import chalk from 'chalk'
import {
  Target,
  asyncForEach,
  moveFile,
  folderExists,
  deleteFolder,
  listFilesAndSubFoldersInFolder,
  pathSepEscaped
} from '@sasjs/utils'
import { getProgramFolders, getMacroFolders } from '../../../utils/config'

const testsBuildFolder = () =>
  path.join(process.currentDir, 'sasjsbuild', 'tests')

export async function compileTestFile(
  target: Target,
  filePath: string,
  testVar: string = ''
) {
  let dependencies = await loadDependencies(
    target,
    path.join(process.projectDir, filePath),
    await getMacroFolders(target.name),
    await getProgramFolders(target),
    'test'
  )
  dependencies = `${testVar ? testVar + '\n' : ''}${dependencies}`

  const destinationPath = path.join(
    testsBuildFolder(),
    filePath.split(path.sep).pop() || ''
  )

  await createFile(destinationPath, dependencies)
}

export async function moveTestFile(filePath: string) {
  const fileName = filePath.split(path.sep).pop() as string

  if (!isTestFile(fileName)) return

  const destinationPath = filePath.replace('sasjsbuild', 'sasjsbuild/tests')

  const testDestinationFolder = destinationPath
    .split(path.sep)
    .slice(0, -1)
    .join(path.sep)

  if (!(await folderExists(testDestinationFolder))) {
    await createFolder(testDestinationFolder)
  }

  await moveFile(filePath, destinationPath)

  const sourceFolder = filePath
    .split(path.sep)
    .slice(0, filePath.split(path.sep).length - 1)
    .join(path.sep)

  if ((await listFilesInFolder(sourceFolder)).length === 0) {
    await deleteFolder(sourceFolder)
  }
}

export async function copyTestMacroFiles(folderPath: string) {
  const folderAbsolutePath = path.join(process.currentDir, folderPath)
  const macroFiles = await listFilesAndSubFoldersInFolder(folderAbsolutePath)
  const macroTestFiles = macroFiles.filter((item) => testFileRegExp.test(item))

  await asyncForEach(macroTestFiles, async (file) => {
    const destinationFile = path.join(testsBuildFolder(), 'macros', file)

    if (!(await fileExists(destinationFile))) {
      await copy(path.join(folderAbsolutePath, file), destinationFile)
    }
  })
}

export const testFileRegExp = /\.test\.(\d+\.)?sas$/i

export const isTestFile = (fileName: string) => testFileRegExp.test(fileName)

export const compileTestFlow = async (target: Target) => {
  const { buildDestinationFolder, buildDestinationTestFolder } =
    await getConstants()

  if (await folderExists(buildDestinationTestFolder)) {
    let testFiles = await (
      await listFilesAndSubFoldersInFolder(buildDestinationTestFolder)
    ).map((file) => path.join('tests', file))

    const testFlow: TestFlow = { tests: [] }
    const testSetUp = target.testConfig?.testSetUp
    const testTearDown = target.testConfig?.testTearDown

    if (testFiles.length) {
      if (testSetUp) {
        const testSetUpPath = testSetUp.split(path.sep).slice(1).join(path.sep)

        if (testFiles.find((file) => file === testSetUpPath)) {
          testFiles = testFiles.filter((file) => file !== testSetUpPath)

          testFlow.testSetUp = testSetUpPath
        }
      }

      if (testTearDown) {
        const testTearDownPath = testTearDown
          .split(path.sep)
          .slice(1)
          .join(path.sep)

        if (testFiles.find((file) => file === testTearDownPath)) {
          testFiles = testFiles.filter((file) => file !== testTearDownPath)

          testFlow.testTearDown = testTearDownPath
        }
      }
    }

    testFlow.tests = testFiles

    await printTestCoverage(testFlow, buildDestinationFolder, target)
  }
}

const printTestCoverage = async (
  testFlow: TestFlow,
  buildDestinationFolder: string,
  target: Target
) => {
  let toCover: string[] = []
  let covered: string[] = []
  let extraTests: string[] = testFlow.tests

  const serviceFolder = path.join(buildDestinationFolder, 'services')

  const collectCoverage = async (
    folder: string,
    type: string,
    filter = (s: string) => true
  ) => {
    if (await folderExists(folder)) {
      const files = (await listFilesAndSubFoldersInFolder(folder))
        .filter(filter)
        .map((file) => path.join(type, file))

      toCover = [...toCover, ...files]

      files.forEach((file) => {
        let shouldBeCovered = path
          .join('tests', file)
          .replace(sasFileRegExp, '')

        if (type === 'macros') {
          shouldBeCovered = shouldBeCovered.split(path.sep).pop() || ''
        }

        if (
          testFlow.tests.find((testFile: string) => {
            let testCovering = testFile.replace(testFileRegExp, '')

            if (type === 'macros') {
              testCovering = testCovering.split(path.sep).pop() || ''
            }

            if (testCovering === shouldBeCovered) {
              extraTests = extraTests.filter(
                (test) =>
                  test.replace(testFileRegExp, '') !==
                  testFile.replace(testFileRegExp, '')
              )
            }

            return testCovering === shouldBeCovered
          })
        ) {
          covered.push(file)
        }
      })
    }
  }

  await collectCoverage(serviceFolder, 'services')

  const jobFolder = path.join(buildDestinationFolder, 'jobs')

  await collectCoverage(jobFolder, 'jobs')

  const macroFolders = await getMacroFolders(target.name)

  await asyncForEach(macroFolders, async (macroFolder) => {
    await collectCoverage(
      macroFolder,
      'macros',
      (file: string) => !testFileRegExp.test(file)
    )
  })

  const filter = (files: string[], type: string) =>
    files.filter((file) => new RegExp(`^${type}`).test(file))

  let coverage: Coverage = {}
  const notCovered = toCover.filter((tc) => !covered.includes(tc))

  const coveredServices = filter(covered, CoverageType.service)
  const servicesToCover = filter(toCover, CoverageType.service)
  const notCoveredServices = filter(notCovered, CoverageType.service)

  notCoveredServices.forEach((file, i) => {
    coverage[file] = {
      Type: CoverageType.service,
      Coverage: CoverageState.notCovered
    }
  })

  const coveredJobs = filter(covered, CoverageType.job)
  const jobsToCover = filter(toCover, CoverageType.job)
  const notCoveredJobs = filter(notCovered, CoverageType.job)

  notCoveredJobs.forEach((file, i) => {
    coverage[file] = {
      Type: CoverageType.job,
      Coverage: CoverageState.notCovered
    }
  })

  const coveredMacros = filter(covered, CoverageType.macro)
  const macrosToCover = filter(toCover, CoverageType.macro)
  let notCoveredMacros = filter(notCovered, CoverageType.macro)

  if (notCoveredMacros.length) {
    await asyncForEach(macroFolders, async (macroFolder: string) => {
      const macros = await (
        await listFilesAndSubFoldersInFolder(macroFolder)
      ).filter((file: string) => !isTestFile(file))

      const macroTypeRegExp = new RegExp(`^macros${pathSepEscaped}`)

      notCoveredMacros = notCoveredMacros.map((macro: string) =>
        macros.includes(macro.replace(macroTypeRegExp, ''))
          ? macro.replace(macroTypeRegExp, macroFolder + path.sep)
          : macro
      )
    })
  }

  notCoveredMacros.forEach((file, i) => {
    coverage[file] = {
      Type: CoverageType.macro,
      Coverage: CoverageState.notCovered
    }
  })

  extraTests.forEach((file) => {
    coverage[file] = {
      Type: CoverageType.test,
      Coverage: CoverageState.standalone
    }
  })

  const calculateCoverage = (covered: number, from: number) =>
    (Math.round((covered / from) * 100) || 0) + '%'

  const formatCoverage = (type: string, covered: string[], toCover: string[]) =>
    toCover.length
      ? process.logger?.info(
          `${type} coverage: ${covered.length}/${
            toCover.length
          } (${chalk.greenBright(
            calculateCoverage(covered.length, toCover.length)
          )})`
        )
      : null

  process.logger?.info('Test coverage:')

  process.logger?.table(
    Object.keys(coverage).map((key) => [
      key,
      coverage[key].Type,
      coverage[key].Coverage
    ]),
    {
      head: ['File', 'Type', 'Coverage']
    }
  )

  formatCoverage('Services', coveredServices, servicesToCover)
  formatCoverage('Jobs', coveredJobs, jobsToCover)
  formatCoverage('Macros', coveredMacros, macrosToCover)
  formatCoverage('Overall', covered, toCover)
  process.logger?.log('')

  await createFile(
    path.join(buildDestinationFolder, 'testFlow.json'),
    JSON.stringify(testFlow, null, 2)
  )
}
