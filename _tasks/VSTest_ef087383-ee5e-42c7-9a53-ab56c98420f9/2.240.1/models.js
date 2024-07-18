"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BatchingType = void 0;
var BatchingType;
(function (BatchingType) {
    BatchingType[BatchingType["TestCaseBased"] = 0] = "TestCaseBased";
    BatchingType[BatchingType["TestExecutionTimeBased"] = 1] = "TestExecutionTimeBased";
    BatchingType[BatchingType["AssemblyBased"] = 2] = "AssemblyBased";
})(BatchingType || (exports.BatchingType = BatchingType = {}));
