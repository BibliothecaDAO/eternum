import type { DeploymentEnvironmentId } from "../../types";
import {
  buildAwsRuntimeTags,
  toAwsTagList,
  type AwsRuntimeCommandConfig,
  type AwsRuntimeConfigRequest,
} from "./config";
import {
  parseJsonOutput,
  runOptionalAwsCleanupCommand,
  runRequiredAwsCommand,
  type AwsCommandRunner,
} from "./commands";
import { buildAwsRuntimeServiceName, truncateWithCleanSuffix } from "./naming";

export interface AwsRuntimeAlarmRequest extends AwsRuntimeConfigRequest {
  environmentId: DeploymentEnvironmentId;
}

interface AwsRuntimeMetricAlarm {
  name: string;
  description: string;
  namespace: string;
  metricName: string;
  comparisonOperator: string;
  statistic: string;
  period: number;
  evaluationPeriods: number;
  threshold: number;
  dimensions: Array<{ name: string; value: string }>;
  treatMissingData?: "breaching" | "notBreaching";
}

export function ensureRuntimeAlarms(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeAlarmRequest,
  config: AwsRuntimeCommandConfig,
  targetGroupArn: string,
): void {
  const serviceName = buildAwsRuntimeServiceName(request);
  const albTargetDimensions = buildAlbTargetMetricDimensions(config.listenerArn, targetGroupArn);

  putRuntimeMetricAlarm(commandRunner, request, config, {
    name: buildRuntimeAlarmName(request, "unhealthy-hosts"),
    description: `Runtime target group has unhealthy hosts for ${serviceName}.`,
    namespace: "AWS/ApplicationELB",
    metricName: "UnHealthyHostCount",
    comparisonOperator: "GreaterThanThreshold",
    statistic: "Average",
    period: 60,
    evaluationPeriods: 5,
    threshold: 0,
    dimensions: albTargetDimensions,
  });

  putRuntimeMetricAlarm(commandRunner, request, config, {
    name: buildRuntimeAlarmName(request, "target-5xx"),
    description: `Runtime target group is returning 5xx responses for ${serviceName}.`,
    namespace: "AWS/ApplicationELB",
    metricName: "HTTPCode_Target_5XX_Count",
    comparisonOperator: "GreaterThanThreshold",
    statistic: "Sum",
    period: 60,
    evaluationPeriods: 2,
    threshold: 0,
    dimensions: albTargetDimensions,
  });

  putRuntimeMetricAlarm(commandRunner, request, config, {
    name: buildRuntimeAlarmName(request, "running-tasks"),
    description: `Runtime ECS service has no running tasks for ${serviceName}.`,
    namespace: "ECS/ContainerInsights",
    metricName: "RunningTaskCount",
    comparisonOperator: "LessThanThreshold",
    statistic: "Average",
    period: 60,
    evaluationPeriods: 5,
    threshold: 1,
    dimensions: [
      { name: "ClusterName", value: config.cluster },
      { name: "ServiceName", value: serviceName },
    ],
  });

  const runtimeMetricDimensions = [
    { name: "EnvironmentId", value: request.environmentId },
    { name: "RuntimeKind", value: request.runtimeKind },
    { name: "RuntimeName", value: request.runtimeName },
    { name: "RuntimeInstanceId", value: request.runtimeInstanceId || "legacy" },
  ];

  putRuntimeMetricAlarm(commandRunner, request, config, {
    name: buildRuntimeAlarmName(request, "snapshot-failures"),
    description: `Runtime snapshot supervisor reported failures for ${serviceName}.`,
    namespace: "Eternum/AwsRuntime",
    metricName: "SnapshotFailure",
    comparisonOperator: "GreaterThanThreshold",
    statistic: "Sum",
    period: 300,
    evaluationPeriods: 1,
    threshold: 0,
    dimensions: runtimeMetricDimensions,
  });

  putRuntimeMetricAlarm(commandRunner, request, config, {
    name: buildRuntimeAlarmName(request, "snapshot-freshness"),
    description: `Runtime snapshots have exceeded two five-minute intervals for ${serviceName}.`,
    namespace: "Eternum/AwsRuntime",
    metricName: "SnapshotSuccess",
    comparisonOperator: "LessThanThreshold",
    statistic: "Sum",
    period: 300,
    evaluationPeriods: 2,
    threshold: 1,
    dimensions: runtimeMetricDimensions,
    treatMissingData: "breaching",
  });
}

export function deleteRuntimeAlarms(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeAlarmRequest,
  config: AwsRuntimeCommandConfig,
): boolean {
  const alarmNames = buildRuntimeAlarmNames(request);
  if (!runtimeAlarmsExist(commandRunner, request, config, alarmNames)) {
    return false;
  }

  runOptionalAwsCleanupCommand(commandRunner, `delete CloudWatch alarms for "${request.runtimeName}"`, [
    "cloudwatch",
    "delete-alarms",
    "--region",
    config.region,
    "--alarm-names",
    ...alarmNames,
  ]);
  return true;
}

function putRuntimeMetricAlarm(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeAlarmRequest,
  config: AwsRuntimeCommandConfig,
  alarm: AwsRuntimeMetricAlarm,
): void {
  runRequiredAwsCommand(commandRunner, `put CloudWatch alarm "${alarm.name}" for "${request.runtimeName}"`, [
    "cloudwatch",
    "put-metric-alarm",
    "--region",
    config.region,
    "--alarm-name",
    alarm.name,
    "--alarm-description",
    alarm.description,
    "--namespace",
    alarm.namespace,
    "--metric-name",
    alarm.metricName,
    "--comparison-operator",
    alarm.comparisonOperator,
    "--statistic",
    alarm.statistic,
    "--period",
    `${alarm.period}`,
    "--evaluation-periods",
    `${alarm.evaluationPeriods}`,
    "--threshold",
    `${alarm.threshold}`,
    "--treat-missing-data",
    alarm.treatMissingData || "notBreaching",
    "--alarm-actions",
    config.snsTopicArn,
    "--dimensions",
    ...alarm.dimensions.map((dimension) => `Name=${dimension.name},Value=${dimension.value}`),
    "--tags",
    ...toAwsTagList(buildAwsRuntimeTags(request)),
  ]);
}

function runtimeAlarmsExist(
  commandRunner: AwsCommandRunner,
  request: AwsRuntimeAlarmRequest,
  config: AwsRuntimeCommandConfig,
  alarmNames: string[],
): boolean {
  const result = runRequiredAwsCommand(commandRunner, `describe CloudWatch alarms for "${request.runtimeName}"`, [
    "cloudwatch",
    "describe-alarms",
    "--region",
    config.region,
    "--alarm-names",
    ...alarmNames,
    "--output",
    "json",
  ]);
  const payload = parseJsonOutput<{ MetricAlarms?: Array<unknown> }>(result.stdout || "", {});
  return (payload.MetricAlarms || []).length > 0;
}

function buildRuntimeAlarmNames(request: AwsRuntimeAlarmRequest): string[] {
  return [
    buildRuntimeAlarmName(request, "unhealthy-hosts"),
    buildRuntimeAlarmName(request, "target-5xx"),
    buildRuntimeAlarmName(request, "running-tasks"),
    buildRuntimeAlarmName(request, "snapshot-failures"),
    buildRuntimeAlarmName(request, "snapshot-freshness"),
  ];
}

function buildRuntimeAlarmName(request: AwsRuntimeAlarmRequest, suffix: string): string {
  return truncateWithCleanSuffix(`${buildAwsRuntimeServiceName(request)}-${suffix}`, 255);
}

function buildAlbTargetMetricDimensions(
  listenerArn: string,
  targetGroupArn: string,
): Array<{ name: string; value: string }> {
  return [
    { name: "LoadBalancer", value: resolveLoadBalancerDimension(listenerArn) },
    { name: "TargetGroup", value: resolveTargetGroupDimension(targetGroupArn) },
  ];
}

function resolveLoadBalancerDimension(listenerArn: string): string {
  const [, suffix] = listenerArn.split(":listener/");
  return suffix ? suffix.split("/").slice(0, 3).join("/") : listenerArn;
}

function resolveTargetGroupDimension(targetGroupArn: string): string {
  const [, suffix] = targetGroupArn.split(":targetgroup/");
  return suffix ? `targetgroup/${suffix}` : targetGroupArn;
}
