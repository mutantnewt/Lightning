import {
  CfnOutput,
  Duration,
  type RemovalPolicy,
  Stack,
  type StackProps,
  Tags,
} from "aws-cdk-lib";
import * as apigw from "aws-cdk-lib/aws-apigateway";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as cloudwatch_actions from "aws-cdk-lib/aws-cloudwatch-actions";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sns_subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";
import * as path from "node:path";

export interface LightningEnvironmentStackProps extends StackProps {
  environmentName: string;
  resourceSuffix: string;
  regionName: string;
  frontendOrigin: string;
  corsAllowedOrigins: string[];
  siteUrl: string;
  appPrefix?: string;
  removalPolicy: RemovalPolicy;
  enableDataDeletionProtection: boolean;
  enableOperationalAlarms: boolean;
  alarmNotificationEmails?: string[];
}

export class LightningEnvironmentStack extends Stack {
  public readonly httpApiUrl: string;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;
  public readonly catalogModeratorGroupName: string;

  constructor(
    scope: Construct,
    id: string,
    props: LightningEnvironmentStackProps,
  ) {
    const {
      environmentName,
      resourceSuffix,
      regionName,
      frontendOrigin,
      corsAllowedOrigins,
      siteUrl,
      appPrefix,
      removalPolicy,
      enableDataDeletionProtection,
      enableOperationalAlarms,
      alarmNotificationEmails = [],
      ...stackProps
    } = props;

    super(scope, id, stackProps);

    const prefix = appPrefix ?? "lightning";
    const userPoolName = `${prefix}-users-${resourceSuffix}`;
    const webClientName = `${prefix}-web-${resourceSuffix}`;
    const catalogModeratorGroupName = `${prefix}-catalog-moderators-${resourceSuffix}`;
    const booksTableName = `${prefix}-books-${resourceSuffix}`;
    const userStateTableName = `${prefix}-user-state-${resourceSuffix}`;
    const bookSuggestionsTableName = `${prefix}-book-suggestions-${resourceSuffix}`;
    const operationsDashboardName = `${prefix}-operations-${resourceSuffix}`;
    const operationsAlarmTopicName = `${prefix}-operations-alerts-${resourceSuffix}`;
    const apiAccessLogGroupName = `/aws/apigateway/${prefix}-http-api-access-${resourceSuffix}`;
    const backendAssetPath = path.join(__dirname, "../../backend");

    Tags.of(this).add("project", "lightning-classics");
    Tags.of(this).add("environment", environmentName);
    Tags.of(this).add("resource-suffix", resourceSuffix);
    Tags.of(this).add("managed-by", "cdk");

    const userPool = new cognito.UserPool(this, "UsersUserPool", {
      userPoolName,
      selfSignUpEnabled: true,
      signInCaseSensitive: false,
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
        tempPasswordValidity: Duration.days(7),
      },
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
        emailSubject: "Your Lightning Classics verification code",
        emailBody: "Your Lightning Classics verification code is {####}",
      },
      removalPolicy,
      mfa: cognito.Mfa.OFF,
    });

    const webClient = userPool.addClient("WebUserPoolClient", {
      userPoolClientName: webClientName,
      generateSecret: false,
      disableOAuth: true,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      refreshTokenValidity: Duration.days(1),
      accessTokenValidity: Duration.minutes(60),
      idTokenValidity: Duration.minutes(60),
    });

    new cognito.CfnUserPoolGroup(this, "CatalogModeratorsGroup", {
      groupName: catalogModeratorGroupName,
      userPoolId: userPool.userPoolId,
      precedence: 1,
      description: "Lightning Classics catalog moderators",
    });

    const booksTable = new dynamodb.Table(this, "BooksTable", {
      tableName: booksTableName,
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      deletionProtection: enableDataDeletionProtection,
      removalPolicy,
    });

    const userStateTable = new dynamodb.Table(this, "UserStateTable", {
      tableName: userStateTableName,
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      deletionProtection: enableDataDeletionProtection,
      removalPolicy,
    });

    const bookSuggestionsTable = new dynamodb.Table(
      this,
      "BookSuggestionsTable",
      {
        tableName: bookSuggestionsTableName,
        partitionKey: {
          name: "pk",
          type: dynamodb.AttributeType.STRING,
        },
        sortKey: {
          name: "sk",
          type: dynamodb.AttributeType.STRING,
        },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        pointInTimeRecoverySpecification: {
          pointInTimeRecoveryEnabled: true,
        },
        deletionProtection: enableDataDeletionProtection,
        removalPolicy,
      },
    );

    const backendCode = lambda.Code.fromAsset(backendAssetPath, {
      exclude: [
        ".DS_Store",
        ".env",
        ".env.*",
        ".local/**",
        "**/*.md",
      ],
    });

    const baseLambdaEnvironment = {
      APP_ENV: environmentName,
      BOOKS_TABLE_NAME: booksTableName,
      USER_STATE_TABLE_NAME: userStateTableName,
      BOOK_SUGGESTIONS_TABLE_NAME: bookSuggestionsTableName,
      COGNITO_USER_POOL_ID: userPool.userPoolId,
      COGNITO_APP_CLIENT_ID: webClient.userPoolClientId,
      CATALOG_MODERATOR_GROUP_NAME: catalogModeratorGroupName,
      CORS_ALLOW_ORIGIN: frontendOrigin,
      CORS_ALLOW_ORIGINS: corsAllowedOrigins.join(","),
      LOG_LEVEL: "info",
    };

    const publicApiFunction = new lambda.Function(this, "PublicApiFunction", {
      functionName: `${prefix}-public-api-${resourceSuffix}`,
      description: "Lightning Classics public API",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      code: backendCode,
      handler: "dist/backend/public-api/src/index.handler",
      memorySize: 512,
      timeout: Duration.seconds(15),
      environment: baseLambdaEnvironment,
      tracing: lambda.Tracing.ACTIVE,
    });

    const authApiFunction = new lambda.Function(this, "AuthApiFunction", {
      functionName: `${prefix}-auth-api-${resourceSuffix}`,
      description: "Lightning Classics authenticated API",
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      code: backendCode,
      handler: "dist/backend/auth-api/src/index.handler",
      memorySize: 512,
      timeout: Duration.seconds(15),
      environment: baseLambdaEnvironment,
      tracing: lambda.Tracing.ACTIVE,
    });

    const privilegedApiFunction = new lambda.Function(
      this,
      "PrivilegedApiFunction",
      {
        functionName: `${prefix}-privileged-api-${resourceSuffix}`,
        description: "Lightning Classics privileged API",
        runtime: lambda.Runtime.NODEJS_22_X,
        architecture: lambda.Architecture.ARM_64,
        code: backendCode,
        handler: "dist/backend/privileged-api/src/index.handler",
        memorySize: 512,
        timeout: Duration.seconds(15),
        environment: baseLambdaEnvironment,
        tracing: lambda.Tracing.ACTIVE,
      },
    );

    booksTable.grantReadData(publicApiFunction);
    userStateTable.grantReadData(publicApiFunction);
    userStateTable.grantReadWriteData(authApiFunction);
    booksTable.grantWriteData(privilegedApiFunction);
    bookSuggestionsTable.grantReadWriteData(privilegedApiFunction);

    const apiAccessLogGroup = new logs.LogGroup(this, "ApiAccessLogGroup", {
      logGroupName: apiAccessLogGroupName,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy,
    });

    const httpApi = new apigwv2.HttpApi(this, "BackendHttpApi", {
      apiName: `${prefix}-api-${resourceSuffix}`,
      createDefaultStage: false,
      corsPreflight: {
        allowOrigins: corsAllowedOrigins,
        allowHeaders: ["authorization", "content-type"],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        maxAge: Duration.days(1),
      },
    });

    const httpStage = httpApi.addStage("DefaultStage", {
      stageName: "$default",
      autoDeploy: true,
      accessLogSettings: {
        destination: new apigwv2.LogGroupLogDestination(apiAccessLogGroup),
        format: apigw.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: false,
        }),
      },
    });
    const cfnHttpStage = httpStage.node.defaultChild as apigwv2.CfnStage;
    cfnHttpStage.defaultRouteSettings = {
      detailedMetricsEnabled: true,
      throttlingBurstLimit: environmentName === "production" ? 100 : 50,
      throttlingRateLimit: environmentName === "production" ? 50 : 25,
    };

    const publicApiIntegration = new integrations.HttpLambdaIntegration(
      "PublicApiIntegration",
      publicApiFunction,
    );

    const authApiIntegration = new integrations.HttpLambdaIntegration(
      "AuthApiIntegration",
      authApiFunction,
    );

    const privilegedApiIntegration = new integrations.HttpLambdaIntegration(
      "PrivilegedApiIntegration",
      privilegedApiFunction,
    );

    const authAuthorizer = new authorizers.HttpJwtAuthorizer(
      "CognitoJwtAuthorizer",
      `https://cognito-idp.${regionName}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [webClient.userPoolClientId],
      },
    );

    httpApi.addRoutes({
      path: "/public/{proxy+}",
      methods: [apigwv2.HttpMethod.GET],
      integration: publicApiIntegration,
    });

    httpApi.addRoutes({
      path: "/auth/{proxy+}",
      methods: [
        apigwv2.HttpMethod.GET,
        apigwv2.HttpMethod.POST,
        apigwv2.HttpMethod.PUT,
        apigwv2.HttpMethod.DELETE,
      ],
      integration: authApiIntegration,
      authorizer: authAuthorizer,
    });

    httpApi.addRoutes({
      path: "/privileged/{proxy+}",
      methods: [apigwv2.HttpMethod.GET, apigwv2.HttpMethod.POST],
      integration: privilegedApiIntegration,
      authorizer: authAuthorizer,
    });

    this.httpApiUrl = httpApi.apiEndpoint;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = webClient.userPoolClientId;
    this.catalogModeratorGroupName = catalogModeratorGroupName;

    const operationsAlarmNames: string[] = [];

    if (enableOperationalAlarms) {
      const operationsAlarmTopic = new sns.Topic(this, "OperationsAlarmTopic", {
        topicName: operationsAlarmTopicName,
        displayName: `Lightning Classics ${environmentName} operations alerts`,
      });
      operationsAlarmTopic.applyRemovalPolicy(removalPolicy);

      const normalizedAlarmNotificationEmails = Array.from(
        new Set(
          alarmNotificationEmails
            .map((email) => email.trim().toLowerCase())
            .filter(Boolean),
        ),
      );

      for (const email of normalizedAlarmNotificationEmails) {
        operationsAlarmTopic.addSubscription(
          new sns_subscriptions.EmailSubscription(email),
        );
      }

      const alarmAction = new cloudwatch_actions.SnsAction(operationsAlarmTopic);
      const metricPeriod = Duration.minutes(5);
      const createAlarm = (
        id: string,
        alarmName: string,
        metric: cloudwatch.IMetric,
        threshold: number,
        description: string,
      ) => {
        const alarm = new cloudwatch.Alarm(this, id, {
          alarmName,
          metric,
          threshold,
          evaluationPeriods: 1,
          datapointsToAlarm: 1,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
          comparisonOperator:
            cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          alarmDescription: description,
        });

        alarm.addAlarmAction(alarmAction);
        operationsAlarmNames.push(alarm.alarmName);
        return alarm;
      };

      createAlarm(
        "PublicApiErrorsAlarm",
        `${prefix}-public-api-errors-${resourceSuffix}`,
        publicApiFunction.metricErrors({
          period: metricPeriod,
          statistic: "sum",
        }),
        1,
        "Lightning Classics public API Lambda reported one or more errors in a 5-minute window.",
      );
      createAlarm(
        "AuthApiErrorsAlarm",
        `${prefix}-auth-api-errors-${resourceSuffix}`,
        authApiFunction.metricErrors({
          period: metricPeriod,
          statistic: "sum",
        }),
        1,
        "Lightning Classics authenticated API Lambda reported one or more errors in a 5-minute window.",
      );
      createAlarm(
        "PrivilegedApiErrorsAlarm",
        `${prefix}-privileged-api-errors-${resourceSuffix}`,
        privilegedApiFunction.metricErrors({
          period: metricPeriod,
          statistic: "sum",
        }),
        1,
        "Lightning Classics privileged API Lambda reported one or more errors in a 5-minute window.",
      );
      createAlarm(
        "PublicApiThrottlesAlarm",
        `${prefix}-public-api-throttles-${resourceSuffix}`,
        publicApiFunction.metricThrottles({
          period: metricPeriod,
          statistic: "sum",
        }),
        1,
        "Lightning Classics public API Lambda experienced throttling in a 5-minute window.",
      );
      createAlarm(
        "AuthApiThrottlesAlarm",
        `${prefix}-auth-api-throttles-${resourceSuffix}`,
        authApiFunction.metricThrottles({
          period: metricPeriod,
          statistic: "sum",
        }),
        1,
        "Lightning Classics authenticated API Lambda experienced throttling in a 5-minute window.",
      );
      createAlarm(
        "PrivilegedApiThrottlesAlarm",
        `${prefix}-privileged-api-throttles-${resourceSuffix}`,
        privilegedApiFunction.metricThrottles({
          period: metricPeriod,
          statistic: "sum",
        }),
        1,
        "Lightning Classics privileged API Lambda experienced throttling in a 5-minute window.",
      );
      createAlarm(
        "HttpApiServerErrorsAlarm",
        `${prefix}-http-api-5xx-${resourceSuffix}`,
        httpStage.metricServerError({
          period: metricPeriod,
          statistic: "sum",
        }),
        1,
        "Lightning Classics HTTP API returned one or more 5xx responses in a 5-minute window.",
      );

      const operationsDashboard = new cloudwatch.Dashboard(
        this,
        "OperationsDashboard",
        {
          dashboardName: operationsDashboardName,
        },
      );

      operationsDashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: "HTTP API Errors",
          left: [
            httpStage.metricServerError({
              period: metricPeriod,
              statistic: "sum",
              label: "5xx",
            }),
            httpStage.metricClientError({
              period: metricPeriod,
              statistic: "sum",
              label: "4xx",
            }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: "HTTP API Latency",
          left: [
            httpStage.metricLatency({
              period: metricPeriod,
              statistic: "p95",
              label: "p95 latency",
            }),
          ],
          width: 12,
        }),
      );

      operationsDashboard.addWidgets(
        new cloudwatch.GraphWidget({
          title: "Lambda Invocations",
          left: [
            publicApiFunction.metricInvocations({
              period: metricPeriod,
              statistic: "sum",
              label: "public",
            }),
            authApiFunction.metricInvocations({
              period: metricPeriod,
              statistic: "sum",
              label: "auth",
            }),
            privilegedApiFunction.metricInvocations({
              period: metricPeriod,
              statistic: "sum",
              label: "privileged",
            }),
          ],
          width: 12,
        }),
        new cloudwatch.GraphWidget({
          title: "Lambda Errors And Throttles",
          left: [
            publicApiFunction.metricErrors({
              period: metricPeriod,
              statistic: "sum",
              label: "public errors",
            }),
            authApiFunction.metricErrors({
              period: metricPeriod,
              statistic: "sum",
              label: "auth errors",
            }),
            privilegedApiFunction.metricErrors({
              period: metricPeriod,
              statistic: "sum",
              label: "privileged errors",
            }),
          ],
          right: [
            publicApiFunction.metricThrottles({
              period: metricPeriod,
              statistic: "sum",
              label: "public throttles",
            }),
            authApiFunction.metricThrottles({
              period: metricPeriod,
              statistic: "sum",
              label: "auth throttles",
            }),
            privilegedApiFunction.metricThrottles({
              period: metricPeriod,
              statistic: "sum",
              label: "privileged throttles",
            }),
          ],
          width: 12,
        }),
      );

      new CfnOutput(this, "OperationsDashboardName", {
        value: operationsDashboard.dashboardName,
      });

      new CfnOutput(this, "OperationsAlarmTopicArn", {
        value: operationsAlarmTopic.topicArn,
      });

      new CfnOutput(this, "OperationsAlarmTopicName", {
        value: operationsAlarmTopic.topicName,
      });

      new CfnOutput(this, "OperationsAlarmNotificationEmailCount", {
        value: String(normalizedAlarmNotificationEmails.length),
      });
    }

    new CfnOutput(this, "EnvironmentName", {
      value: environmentName,
    });

    new CfnOutput(this, "ResourceSuffix", {
      value: resourceSuffix,
    });

    new CfnOutput(this, "WorkloadRegion", {
      value: regionName,
    });

    new CfnOutput(this, "FrontendOrigin", {
      value: frontendOrigin,
    });

    new CfnOutput(this, "CorsAllowedOrigins", {
      value: corsAllowedOrigins.join(","),
    });

    new CfnOutput(this, "SiteUrl", {
      value: siteUrl,
    });

    new CfnOutput(this, "UserPoolName", {
      value: userPoolName,
    });

    new CfnOutput(this, "UserPoolId", {
      value: this.userPoolId,
    });

    new CfnOutput(this, "UserPoolClientName", {
      value: webClientName,
    });

    new CfnOutput(this, "UserPoolClientId", {
      value: this.userPoolClientId,
    });

    new CfnOutput(this, "CatalogModeratorGroupName", {
      value: this.catalogModeratorGroupName,
    });

    new CfnOutput(this, "BooksTableName", {
      value: booksTable.tableName,
    });

    new CfnOutput(this, "UserStateTableName", {
      value: userStateTable.tableName,
    });

    new CfnOutput(this, "BookSuggestionsTableName", {
      value: bookSuggestionsTable.tableName,
    });

    new CfnOutput(this, "PublicApiFunctionName", {
      value: publicApiFunction.functionName,
    });

    new CfnOutput(this, "AuthApiFunctionName", {
      value: authApiFunction.functionName,
    });

    new CfnOutput(this, "PrivilegedApiFunctionName", {
      value: privilegedApiFunction.functionName,
    });

    new CfnOutput(this, "HttpApiUrl", {
      value: this.httpApiUrl,
    });

    new CfnOutput(this, "PublicApiBaseUrl", {
      value: this.httpApiUrl,
    });

    new CfnOutput(this, "AuthApiBaseUrl", {
      value: this.httpApiUrl,
    });

    new CfnOutput(this, "PrivilegedApiBaseUrl", {
      value: this.httpApiUrl,
    });

    new CfnOutput(this, "ApiAccessLogGroupName", {
      value: apiAccessLogGroup.logGroupName,
    });

    new CfnOutput(this, "OperationsAlarmNames", {
      value: operationsAlarmNames.join(","),
    });
  }
}
