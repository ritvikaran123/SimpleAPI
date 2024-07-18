"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishTelemetry = exports.publishEvent = void 0;
const tl = require("azure-pipelines-task-lib/task");
const area = 'TestExecution';
const feature = 'TestExecutionTask';
function getDefaultProps() {
    return {
        releaseuri: tl.getVariable('Release.ReleaseUri'),
        releaseid: tl.getVariable('Release.ReleaseId'),
        builduri: tl.getVariable('Build.BuildUri'),
        buildid: tl.getVariable('Build.Buildid')
    };
}
function publishEvent(properties) {
    try {
        tl.assertAgent('2.125.0');
        publishTelemetry(area, feature, Object.assign(getDefaultProps(), properties));
    }
    catch (err) {
        tl.debug('Unable to publish telemetry due to lower agent version.');
    }
}
exports.publishEvent = publishEvent;
function publishTelemetry(area, feature, properties) {
    const data = JSON.stringify(properties);
    tl.debug('telemetry area: ' + area + ' feature: ' + feature + ' data: ' + data);
    tl.command('telemetry.publish', { 'area': area, 'feature': feature }, data);
}
exports.publishTelemetry = publishTelemetry;
