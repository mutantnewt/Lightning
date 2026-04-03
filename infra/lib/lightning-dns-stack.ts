import { CfnOutput, Fn, Stack, type StackProps, Tags } from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";

export interface LightningDnsStackProps extends StackProps {
  rootDomainName: string;
}

export class LightningDnsStack extends Stack {
  public readonly hostedZone: route53.PublicHostedZone;

  constructor(scope: Construct, id: string, props: LightningDnsStackProps) {
    const { rootDomainName, ...stackProps } = props;

    super(scope, id, stackProps);

    Tags.of(this).add("project", "lightning-classics");
    Tags.of(this).add("component", "dns");
    Tags.of(this).add("managed-by", "cdk");

    this.hostedZone = new route53.PublicHostedZone(this, "PublicHostedZone", {
      zoneName: rootDomainName,
      comment: "Lightning Classics public hosted zone",
    });

    new CfnOutput(this, "HostedZoneName", {
      value: this.hostedZone.zoneName,
    });

    new CfnOutput(this, "HostedZoneId", {
      value: this.hostedZone.hostedZoneId,
    });

    if (this.hostedZone.hostedZoneNameServers) {
      new CfnOutput(this, "HostedZoneNameServers", {
        value: Fn.join(",", this.hostedZone.hostedZoneNameServers),
      });

      new CfnOutput(this, "HostedZoneNameServer1", {
        value: Fn.select(0, this.hostedZone.hostedZoneNameServers),
      });

      new CfnOutput(this, "HostedZoneNameServer2", {
        value: Fn.select(1, this.hostedZone.hostedZoneNameServers),
      });

      new CfnOutput(this, "HostedZoneNameServer3", {
        value: Fn.select(2, this.hostedZone.hostedZoneNameServers),
      });

      new CfnOutput(this, "HostedZoneNameServer4", {
        value: Fn.select(3, this.hostedZone.hostedZoneNameServers),
      });
    }
  }
}
