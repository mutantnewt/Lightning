import {
  Aws,
  CfnCondition,
  CfnOutput,
  CfnParameter,
  Fn,
  RemovalPolicy,
  Stack,
  type StackProps,
  Tags,
} from "aws-cdk-lib";
import * as amplify from "aws-cdk-lib/aws-amplify";
import * as s3 from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";

export interface LightningFrontendHostingStackProps extends StackProps {
  environmentName: "staging" | "production";
  resourceSuffix: string;
  regionName: string;
  appName: string;
  branchName: string;
  siteUrl: string;
  rootDomainName: string;
  customDomainName: string;
  subdomainPrefix: string;
  repositoryUrlDefault: string;
  apiBaseUrl: string;
  cognitoUserPoolId: string;
  cognitoUserPoolClientId: string;
  catalogModeratorGroupName: string;
}

function toCspSource(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value;
  }
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function buildAmplifyBuildSpec(): string {
  return [
    "version: 1",
    "frontend:",
    "  phases:",
    "    preBuild:",
    "      commands:",
    "        - cd literary-light && npm ci",
    "    build:",
    "      commands:",
    "        - cd literary-light && npm run build",
    "  artifacts:",
    "    baseDirectory: literary-light/dist",
    "    files:",
    "      - '**/*'",
    "  cache:",
    "    paths:",
    "      - literary-light/node_modules/**/*",
  ].join("\n");
}

function buildContentSecurityPolicy(
  props: LightningFrontendHostingStackProps,
): string {
  const siteOrigin = toCspSource(props.siteUrl);
  const apiOriginPattern = `https://*.execute-api.${props.regionName}.amazonaws.com`;
  const cognitoIdpOrigin = `https://cognito-idp.${props.regionName}.amazonaws.com`;
  const connectSrc = unique([
    "'self'",
    apiOriginPattern,
    siteOrigin,
    cognitoIdpOrigin,
    "https://*.amazonaws.com",
    "https://*.amazoncognito.com",
    "https://ipapi.co",
    "https://openlibrary.org",
  ]);
  const imgSrc = unique([
    "'self'",
    "data:",
    "https://covers.openlibrary.org",
  ]);
  const styleSrc = unique([
    "'self'",
    "'unsafe-inline'",
    "https://fonts.googleapis.com",
  ]);
  const fontSrc = unique([
    "'self'",
    "data:",
    "https://fonts.gstatic.com",
  ]);

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "object-src 'none'",
    "script-src 'self'",
    `style-src ${styleSrc.join(" ")}`,
    `font-src ${fontSrc.join(" ")}`,
    `img-src ${imgSrc.join(" ")}`,
    `connect-src ${connectSrc.join(" ")}`,
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

function buildAmplifyCustomHeaders(
  props: LightningFrontendHostingStackProps,
): string {
  const contentSecurityPolicy = buildContentSecurityPolicy(props);

  return [
    "customHeaders:",
    "  - pattern: '**/*'",
    "    headers:",
    "      - key: Content-Security-Policy",
    `        value: ${JSON.stringify(contentSecurityPolicy)}`,
    "      - key: Strict-Transport-Security",
    "        value: max-age=31536000; includeSubDomains; preload",
    "      - key: X-Frame-Options",
      "        value: DENY",
    "      - key: X-Content-Type-Options",
      "        value: nosniff",
    "      - key: Referrer-Policy",
      "        value: strict-origin-when-cross-origin",
    "      - key: Permissions-Policy",
      "        value: camera=(), microphone=(), geolocation=()",
    "      - key: Cross-Origin-Opener-Policy",
      "        value: same-origin",
    "      - key: Cross-Origin-Resource-Policy",
    "        value: same-site",
  ].join("\n");
}

function buildAmplifySpaRules(): amplify.CfnApp.CustomRuleProperty[] {
  return [
    {
      source:
        "</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|json|map|png|svg|txt|webp|woff|woff2|ttf)$)([^.]+$)/>",
      target: "/index.html",
      status: "200",
    },
  ];
}

function buildBranchEnvironmentVariables(
  props: LightningFrontendHostingStackProps,
): amplify.CfnBranch.EnvironmentVariableProperty[] {
  return [
    {
      name: "VITE_APP_ENV",
      value: props.environmentName,
    },
    {
      name: "VITE_AWS_REGION",
      value: props.regionName,
    },
    {
      name: "VITE_COGNITO_USER_POOL_ID",
      value: props.cognitoUserPoolId,
    },
    {
      name: "VITE_COGNITO_USER_POOL_CLIENT_ID",
      value: props.cognitoUserPoolClientId,
    },
    {
      name: "VITE_CATALOG_MODERATOR_GROUP_NAME",
      value: props.catalogModeratorGroupName,
    },
    {
      name: "VITE_API_PUBLIC_BASE_URL",
      value: props.apiBaseUrl,
    },
    {
      name: "VITE_API_AUTH_BASE_URL",
      value: props.apiBaseUrl,
    },
    {
      name: "VITE_API_PRIVILEGED_BASE_URL",
      value: props.apiBaseUrl,
    },
    {
      name: "VITE_SITE_URL",
      value: props.siteUrl,
    },
  ];
}

export class LightningFrontendHostingStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: LightningFrontendHostingStackProps,
  ) {
    const {
      environmentName,
      resourceSuffix,
      regionName,
      appName,
      branchName,
      siteUrl,
      rootDomainName,
      customDomainName,
      subdomainPrefix,
      repositoryUrlDefault,
      apiBaseUrl,
      cognitoUserPoolId,
      cognitoUserPoolClientId,
      catalogModeratorGroupName,
      ...stackProps
    } = props;

    super(scope, id, stackProps);

    Tags.of(this).add("project", "lightning-classics");
    Tags.of(this).add("environment", environmentName);
    Tags.of(this).add("component", "frontend-hosting");
    Tags.of(this).add("managed-by", "cdk");

    const releaseArchiveBucket = new s3.Bucket(this, "FrontendReleaseArchiveBucket", {
      bucketName: `lightning-frontend-releases-${resourceSuffix}-${Aws.ACCOUNT_ID}-${regionName}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    const repositoryUrlParameter = new CfnParameter(
      this,
      "AmplifyRepositoryUrl",
      {
        type: "String",
        default: repositoryUrlDefault,
        description:
          "Git repository URL for the Lightning Classics frontend source.",
      },
    );

    const deploymentModeParameter = new CfnParameter(
      this,
      "AmplifyDeploymentMode",
      {
        type: "String",
        default: "MANUAL",
        allowedValues: ["MANUAL", "REPOSITORY"],
        description:
          "Amplify deployment mode. MANUAL creates a hosted app and branch without a connected repository. REPOSITORY connects Amplify to GitHub using the supplied access token.",
      },
    );

    const accessTokenParameter = new CfnParameter(this, "AmplifyAccessToken", {
      type: "String",
      noEcho: true,
      default: "",
      description:
        "GitHub personal access token for repository-connected Amplify mode. Leave blank when using MANUAL deployment mode.",
    });

    const enableCustomDomainParameter = new CfnParameter(
      this,
      "EnableCustomDomainAssociation",
      {
        type: "String",
        default: "false",
        allowedValues: ["true", "false"],
        description:
          "Set to true after Route 53 delegation is in place and the custom domain should be attached to Amplify.",
      },
    );

    const customCertificateArnParameter = new CfnParameter(
      this,
      "AmplifyCustomCertificateArn",
      {
        type: "String",
        default: "",
        description:
          "Optional us-east-1 ACM certificate ARN for the Amplify custom domain. Leave blank to use Amplify-managed certificates.",
      },
    );

    const useRepositoryModeCondition = new CfnCondition(
      this,
      "UseRepositoryMode",
      {
        expression: Fn.conditionEquals(
          deploymentModeParameter.valueAsString,
          "REPOSITORY",
        ),
      },
    );

    const enableCustomDomainCondition = new CfnCondition(
      this,
      "EnableCustomDomain",
      {
        expression: Fn.conditionEquals(
          enableCustomDomainParameter.valueAsString,
          "true",
        ),
      },
    );

    const createDomainAssociationCondition = new CfnCondition(
      this,
      "CreateDomainAssociation",
      {
        expression: enableCustomDomainCondition,
      },
    );

    const useCustomCertificateCondition = new CfnCondition(
      this,
      "UseCustomCertificate",
      {
        expression: Fn.conditionNot(
          Fn.conditionEquals(customCertificateArnParameter.valueAsString, ""),
        ),
      },
    );

    const app = new amplify.CfnApp(this, "AmplifyApp", {
      name: appName,
      description: `Lightning Classics ${environmentName} frontend hosting`,
      repository: Fn.conditionIf(
        useRepositoryModeCondition.logicalId,
        repositoryUrlParameter.valueAsString,
        Aws.NO_VALUE,
      ) as unknown as string,
      accessToken: Fn.conditionIf(
        useRepositoryModeCondition.logicalId,
        accessTokenParameter.valueAsString,
        Aws.NO_VALUE,
      ) as unknown as string,
      platform: "WEB",
      buildSpec: buildAmplifyBuildSpec(),
      customHeaders: buildAmplifyCustomHeaders(props),
      customRules: buildAmplifySpaRules(),
      enableBranchAutoDeletion: Fn.conditionIf(
        useRepositoryModeCondition.logicalId,
        true,
        false,
      ) as unknown as boolean,
      cacheConfig: {
        type: "AMPLIFY_MANAGED_NO_COOKIES",
      },
      jobConfig: {
        buildComputeType: "STANDARD_8GB",
      },
    });

    const branch = new amplify.CfnBranch(this, "AmplifyBranch", {
      appId: app.attrAppId,
      branchName,
      description: `Lightning Classics ${environmentName} hosted branch`,
      enableAutoBuild: Fn.conditionIf(
        useRepositoryModeCondition.logicalId,
        true,
        false,
      ) as unknown as boolean,
      enablePerformanceMode: environmentName === "production",
      enablePullRequestPreview: Fn.conditionIf(
        useRepositoryModeCondition.logicalId,
        environmentName === "staging",
        false,
      ) as unknown as boolean,
      enableSkewProtection: true,
      framework: "React",
      stage: environmentName === "production" ? "PRODUCTION" : "BETA",
      environmentVariables: buildBranchEnvironmentVariables({
        ...props,
        apiBaseUrl,
        cognitoUserPoolId,
        cognitoUserPoolClientId,
        catalogModeratorGroupName,
      }),
    });
    branch.addDependency(app);

    const domain = new amplify.CfnDomain(this, "AmplifyDomainAssociation", {
      appId: app.attrAppId,
      domainName: rootDomainName,
      enableAutoSubDomain: false,
      certificateSettings: Fn.conditionIf(
        useCustomCertificateCondition.logicalId,
        {
          CertificateType: "CUSTOM",
          CustomCertificateArn: customCertificateArnParameter.valueAsString,
        },
        Aws.NO_VALUE,
      ) as unknown as amplify.CfnDomain.CertificateSettingsProperty,
      subDomainSettings: [
        {
          branchName,
          prefix: subdomainPrefix,
        },
      ],
    });
    domain.cfnOptions.condition = createDomainAssociationCondition;
    domain.addDependency(branch);

    new CfnOutput(this, "FrontendEnvironmentName", {
      value: environmentName,
    });

    new CfnOutput(this, "AmplifyAppName", {
      value: appName,
    });

    new CfnOutput(this, "AmplifyBranchName", {
      value: branchName,
    });

    new CfnOutput(this, "FrontendSiteUrl", {
      value: siteUrl,
    });

    new CfnOutput(this, "FrontendCustomDomainName", {
      value: customDomainName,
    });

    new CfnOutput(this, "FrontendRepositoryUrl", {
      value: repositoryUrlParameter.valueAsString,
    });

    new CfnOutput(this, "FrontendDeploymentMode", {
      value: deploymentModeParameter.valueAsString,
    });

    new CfnOutput(this, "FrontendApiBaseUrl", {
      value: apiBaseUrl,
    });

    new CfnOutput(this, "FrontendCognitoUserPoolId", {
      value: cognitoUserPoolId,
    });

    new CfnOutput(this, "FrontendCognitoUserPoolClientId", {
      value: cognitoUserPoolClientId,
    });

    new CfnOutput(this, "FrontendCatalogModeratorGroupName", {
      value: catalogModeratorGroupName,
    });

    new CfnOutput(this, "FrontendReleaseArchiveBucketName", {
      value: releaseArchiveBucket.bucketName,
    });

    new CfnOutput(this, "FrontendReleaseArchivePrefix", {
      value: "releases",
    });

    new CfnOutput(this, "FrontendCertificateMode", {
      value: Fn.conditionIf(
        useCustomCertificateCondition.logicalId,
        "CUSTOM",
        "AMPLIFY_MANAGED",
      ).toString(),
    });

    new CfnOutput(this, "FrontendHostingReadyForDeploy", {
      value: "true",
    });

    new CfnOutput(this, "AmplifyAppId", {
      value: app.attrAppId,
    });

    new CfnOutput(this, "AmplifyDefaultDomain", {
      value: app.attrDefaultDomain,
    });

    new CfnOutput(this, "AmplifyDomainStatus", {
      value: domain.attrDomainStatus,
      condition: createDomainAssociationCondition,
    });

    new CfnOutput(this, "AmplifyDomainUpdateStatus", {
      value: domain.attrUpdateStatus,
      condition: createDomainAssociationCondition,
    });

    new CfnOutput(this, "AmplifyDomainCertificateRecord", {
      value: domain.attrCertificateRecord,
      condition: createDomainAssociationCondition,
    });
  }
}
