"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const taskLib = require("azure-pipelines-task-lib/task");
const path = require("path");
const nuGetGetter = require("azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter");
const peParser = require("azure-pipelines-tasks-packaging-common/pe-parser");
const telemetry = require("azure-pipelines-tasks-utility-common/telemetry");
const DEFAULT_NUGET_VERSION = '>=4.9';
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        let nugetVersion;
        let checkLatest;
        let nuGetPath;
        let msBuildSemVer;
        try {
            taskLib.setResourcePath(path.join(__dirname, 'task.json'));
            const versionSpec = taskLib.getInput('versionSpec', false) || DEFAULT_NUGET_VERSION;
            checkLatest = taskLib.getBoolInput('checkLatest', false);
            nuGetPath = yield nuGetGetter.getNuGet(versionSpec, checkLatest, true);
            const nugetVersionInfo = yield peParser.getFileVersionInfoAsync(nuGetPath);
            if (nugetVersionInfo && nugetVersionInfo.fileVersion) {
                nugetVersion = nugetVersionInfo.fileVersion.toString();
            }
            msBuildSemVer = yield nuGetGetter.getMSBuildVersionString();
        }
        catch (error) {
            console.error('ERR:' + error.message);
            taskLib.setResult(taskLib.TaskResult.Failed, '');
        }
        finally {
            _logNugetToolInstallerStartupVariables(nugetVersion, checkLatest, nuGetPath, msBuildSemVer);
        }
    });
}
function _logNugetToolInstallerStartupVariables(nugetVersion, checkLatest, nuGetPath, msBuildSemVer) {
    try {
        const telem = {
            "NUGET_EXE_TOOL_PATH_ENV_VAR": taskLib.getVariable(nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR),
            "DEFAULT_NUGET_VERSION": DEFAULT_NUGET_VERSION,
            "isCheckLatestEnabled": checkLatest,
            "requestedNuGetVersionSpec": taskLib.getInput('versionSpec', false),
            "nuGetPath": nuGetPath,
            "nugetVersion": nugetVersion,
            "msBuildVersion": msBuildSemVer
        };
        telemetry.emitTelemetry("Packaging", "NuGetToolInstaller", telem);
    }
    catch (err) {
        taskLib.debug(`Unable to log NuGet Tool Installer task init telemetry. Err:(${err})`);
    }
}
run();
