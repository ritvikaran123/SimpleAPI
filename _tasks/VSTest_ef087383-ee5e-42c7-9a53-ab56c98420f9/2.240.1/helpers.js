"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Helper = exports.Constants = void 0;
const fs = require("fs");
const tl = require("azure-pipelines-task-lib/task");
const path = require("path");
const Q = require("q");
const os = require("os");
const ci = require("./cieventlogger");
const constants = require("./constants");
const str = require('string');
const uuid = require('uuid');
const xml2js = require('xml2js');
const parser = new xml2js.Parser();
const builder = new xml2js.Builder();
class Constants {
}
exports.Constants = Constants;
Constants.vsTestVersionString = 'version';
Constants.vsTestLocationString = 'location';
Constants.systemDefaultWorkingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
class Helper {
    static addToProcessEnvVars(envVars, name, value) {
        if (!this.isNullEmptyOrUndefined(value)) {
            if (!name.includes('AccessToken')) {
                tl.debug('Setting the process env var: ' + name + ' to: ' + value);
            }
            envVars[name] = value;
        }
    }
    static setEnvironmentVariableToString(envVars, name, value) {
        if (!this.isNullEmptyOrUndefined(value)) {
            envVars[name] = value.toString();
        }
    }
    static isNullEmptyOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }
    static isNullOrUndefined(obj) {
        return obj === null || obj === '' || obj === undefined;
    }
    static isNullOrWhitespace(input) {
        if (typeof input === 'undefined' || input === null) {
            return true;
        }
        return input.replace(/\s/g, '').length < 1;
    }
    static trimString(input) {
        if (input) {
            return input.replace(/^(?=\n)$|^\s*|\s*$|\n\n+/gm, '');
        }
        return input;
    }
    static isToolsInstallerFlow(config) {
        return config.toolsInstallerConfig && config.toolsInstallerConfig.isToolsInstallerInUse;
    }
    static pathExistsAsFile(path) {
        return tl.exist(path) && tl.stats(path).isFile();
    }
    static pathExistsAsDirectory(path) {
        return tl.exist(path) && tl.stats(path).isDirectory();
    }
    static isDebugEnabled() {
        const sysDebug = tl.getVariable('System.Debug');
        if (sysDebug === undefined) {
            return false;
        }
        return sysDebug.toLowerCase() === 'true';
    }
    static publishEventToCi(areaCode, message, tracePoint, isUserError) {
        const taskProps = { areacode: '', result: '', tracepoint: 0, isusererror: false };
        taskProps.areacode = areaCode;
        taskProps.result = message;
        taskProps.tracepoint = tracePoint;
        taskProps.isusererror = isUserError;
        ci.publishEvent(taskProps);
    }
    static getXmlContents(filePath) {
        const defer = Q.defer();
        Helper.readFileContents(filePath, 'utf-8')
            .then(function (xmlContents) {
            parser.parseString(xmlContents, function (err, result) {
                if (err) {
                    defer.resolve(null);
                }
                else {
                    defer.resolve(result);
                }
            });
        })
            .fail(function (err) {
            defer.reject(err);
        });
        return defer.promise;
    }
    static saveToFile(fileContents, extension) {
        const defer = Q.defer();
        const tempFile = Helper.GenerateTempFile(uuid.v1() + extension);
        fs.writeFile(tempFile, fileContents, function (err) {
            if (err) {
                defer.reject(err);
            }
            tl.debug('Temporary file created at ' + tempFile);
            defer.resolve(tempFile);
        });
        return defer.promise;
    }
    static GenerateTempFile(fileName) {
        return path.join(Helper.GetTempFolder(), fileName);
    }
    static GetTempFolder() {
        try {
            tl.assertAgent('2.115.0');
            const tmpDir = tl.getVariable('Agent.TempDirectory');
            return tmpDir;
        }
        catch (err) {
            tl.warning(tl.loc('UpgradeAgentMessage'));
            return os.tmpdir();
        }
    }
    static readFileContents(filePath, encoding) {
        const defer = Q.defer();
        fs.readFile(filePath, encoding, (err, data) => {
            if (err) {
                defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
            }
            else {
                defer.resolve(data);
            }
        });
        return defer.promise;
    }
    static readFileContentsSync(filePath, encoding) {
        return fs.readFileSync(filePath, encoding);
    }
    static writeXmlFile(result, settingsFile, fileExt) {
        const defer = Q.defer();
        let runSettingsContent = builder.buildObject(result);
        runSettingsContent = str(runSettingsContent).replaceAll('&#xD;', '').s;
        //This is to fix carriage return any other special chars will not be replaced
        Helper.saveToFile(runSettingsContent, fileExt)
            .then(function (fileName) {
            defer.resolve(fileName);
            return defer.promise;
        })
            .fail(function (err) {
            defer.reject(err);
        });
        return defer.promise;
    }
    static getVSVersion(versionNum) {
        switch (versionNum) {
            case 12: return '2013';
            case 14: return '2015';
            case 15: return '2017';
            case 16: return '2019';
            case 17: return '2022';
            default: return 'selected';
        }
    }
    static printMultiLineLog(multiLineString, logFunction) {
        const lines = multiLineString.toString().split('\n');
        lines.forEach(function (line) {
            if (line.trim().length === 0) {
                return;
            }
            logFunction(line);
        });
    }
    static modifyVsTestConsoleArgsForResponseFile(argument) {
        if (argument) {
            if (!argument.startsWith('/')) {
                return '\"' + argument + '\"';
            }
            else {
                // we need to add quotes to args we are passing after : as the arg value can have spaces
                // we dont need to changes the guy who is creating the args as toolrunner already takes care of this
                // for response file we need to take care of this ourselves
                // eg: /settings:c:\a b\1.settings should become /settings:"C:\a b\1.settings"
                let indexOfColon = argument.indexOf(':'); // find if args has ':'
                if (indexOfColon > 0 && argument[indexOfColon + 1] !== '\"') { // only process when quotes are not there
                    let modifyString = argument.substring(0, indexOfColon + 1); // get string till colon
                    modifyString = modifyString + '\"' + argument.substring(indexOfColon + 1) + '\"'; // append '"' and rest of the string
                    return modifyString;
                }
            }
        }
        return argument;
    }
    static setProfilerVariables(envVars) {
        const vsTestPackageLocation = tl.getVariable(constants.VsTestToolsInstaller.PathToVsTestToolVariable);
        var splitString = vsTestPackageLocation.split('\\');
        var tpVer = parseInt(splitString[splitString.length - 2].split(".")[0], 10);
        var profilerProxyLocation;
        tl.debug("TestPlatform Version Detected :" + tpVer);
        if (tpVer < 17) {
            profilerProxyLocation = tl.findMatch(vsTestPackageLocation, '**\\amd64\\Microsoft.IntelliTrace.ProfilerProxy.dll');
            if (profilerProxyLocation && profilerProxyLocation.length !== 0) {
                envVars.COR_PROFILER_PATH_64 = profilerProxyLocation[0];
            }
            else {
                profilerProxyLocation = tl.findMatch(vsTestPackageLocation, '**\\x64\\Microsoft.IntelliTrace.ProfilerProxy.dll');
                if (profilerProxyLocation && profilerProxyLocation.length !== 0) {
                    envVars.COR_PROFILER_PATH_64 = profilerProxyLocation[0];
                }
                else {
                    Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1042, false);
                    tl.warning(tl.loc('testImpactAndCCWontWork'));
                }
            }
            profilerProxyLocation = tl.findMatch(vsTestPackageLocation, '**\\x86\\Microsoft.IntelliTrace.ProfilerProxy.dll');
            if (profilerProxyLocation && profilerProxyLocation.length !== 0) {
                envVars.COR_PROFILER_PATH_32 = profilerProxyLocation[0];
            }
            else {
                Helper.publishEventToCi(constants.AreaCodes.TOOLSINSTALLERCACHENOTFOUND, tl.loc('testImpactAndCCWontWork'), 1042, false);
                tl.warning(tl.loc('testImpactAndCCWontWork'));
            }
        }
        return envVars;
    }
    // set the console code page to "UTF-8"
    static setConsoleCodePage() {
        tl.debug("Changing active code page to UTF-8");
        const chcp = tl.tool(path.resolve(process.env.windir, "system32", "chcp.com"));
        chcp.arg(["65001"]);
        chcp.execSync({ silent: true });
    }
    static stringToBool(inputString) {
        return !this.isNullEmptyOrUndefined(inputString) && inputString.toLowerCase() === 'true';
    }
    static uploadFile(file) {
        try {
            if (Helper.pathExistsAsFile(file)) {
                const stats = fs.statSync(file);
                tl.debug('File exists. Size: ' + stats.size + ' Bytes');
                console.log('##vso[task.uploadfile]' + file);
            }
        }
        catch (err) {
            tl.debug(`Failed to upload file ${file} with error ${err}`);
        }
    }
    // Utility function used to remove empty or spurious nodes from the input json file
    static removeEmptyNodes(obj) {
        if (obj === null || obj === undefined) {
            return;
        }
        if (typeof obj !== 'object' && typeof obj !== undefined) {
            return;
        }
        const keys = Object.keys(obj);
        for (var index in Object.keys(obj)) {
            // should call if object is not empty
            if (obj[keys[index]] && Object.keys(obj[keys[index]]).length != 0) {
                Helper.removeEmptyNodes(obj[keys[index]]);
            }
            if (obj[keys[index]] == undefined || obj[keys[index]] == null || (typeof obj[keys[index]] == "object" && Object.keys(obj[keys[index]]).length == 0)) {
                tl.debug(`Removing node ${keys[index]} as its value is ${obj[keys[index]]}.`);
                delete obj[keys[index]];
            }
        }
    }
}
exports.Helper = Helper;
