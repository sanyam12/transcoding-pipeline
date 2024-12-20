import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { CreateAccessKeyCommand, CreateAccessKeyCommandOutput, IAMClient } from "@aws-sdk/client-iam";
import type { S3Event } from "aws-lambda";
import {ECSClient, RunTaskCommand} from "@aws-sdk/client-ecs";
require('dotenv').config();

const iamClient = new IAMClient({});
const ecsClient = new ECSClient({
    region: "ap-south-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS || "",
            secretAccessKey: process.env.SECRET || ""
        }
});

// const client = new SQSClient({ region: "ap-south-1" });

const getUser: () => Promise<CreateAccessKeyCommandOutput | undefined> = async () => {
    try {
        const command = new CreateAccessKeyCommand({ UserName: "sqs.ytwrapper" });
        const test = await iamClient.send(command);
        return test
    } catch (error) {
        console.error(error);
    }
};

async function init() {
    // const creds = await getUser();
    // if(!creds) {
    //     console.error("No creds found");
    //     return;
    // }
    const client = new SQSClient({
        region: "ap-south-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS || "",
            secretAccessKey: process.env.SECRET || ""
        }
    });
    const command = new ReceiveMessageCommand({
        QueueUrl: "https://sqs.ap-south-1.amazonaws.com/854326516450/TempRawVideoS3Queue",
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20
    });

    while (true) {
        console.log("Polling for messages");
        
        const { Messages } = await client.send(command);
        console.log("Messages", Messages);
        
        if (!Messages) {
            console.log("No messages found");
            continue;
        }
        try {

            for (const message of Messages) {
                const { MessageId, Body } = message;
                console.log(MessageId, Body);
                if (!Body) {
                    continue;
                }
                const event: S3Event = JSON.parse(Body);
                console.log(event);
                if ("Service" in event && "Event" in event) {
                    if (event.Event === "s3:TestEvent"){
                        //Delete the message
                        const deleteCommand = new DeleteMessageCommand({
                            QueueUrl: "https://sqs.ap-south-1.amazonaws.com/854326516450/TempRawVideoS3Queue",
                            ReceiptHandle: message.ReceiptHandle
                        });
                        await client.send(deleteCommand);
                        continue;
                    }
                }

                for (const record of event.Records) {
                    const { s3 } = record;
                    if (!s3) continue;
                    if( s3.object.size===0){
                        const deleteCommand = new DeleteMessageCommand({
                            QueueUrl: "https://sqs.ap-south-1.amazonaws.com/854326516450/TempRawVideoS3Queue",
                            ReceiptHandle: message.ReceiptHandle
                        });
                        await client.send(deleteCommand);
                        continue;
                    }
                    const { bucket, object: { key } } = s3;

                    //spin the docker container
                    console.log(`Spinning the docker container ${bucket.name} ${key}`);
                    
                    const runTaskCommand = new RunTaskCommand({
                        taskDefinition: "arn:aws:ecs:ap-south-1:854326516450:task-definition/video-transcoder",
                        cluster: "arn:aws:ecs:ap-south-1:854326516450:cluster/dev-video-transcoder",
                        launchType: "FARGATE",
                        networkConfiguration: {
                            awsvpcConfiguration: {
                                securityGroups: ["sg-0df5ada7cdf30c968"],
                                subnets: ["subnet-0eae154f58d935c17", "subnet-0290f433c67f1407c", "subnet-02a89e2b24d71b838"],
                                assignPublicIp: "ENABLED"
                            }
                        },
                        overrides: {
                            containerOverrides: [
                                {
                                    name: "hlsNewRepo",
                                    environment: [
                                        {
                                            name: "BUCKET_NAME",
                                            value: bucket.name
                                        },
                                        {
                                            name: "KEY",
                                            value: key
                                        }
                                    ]
                                }
                            ]
                        }
                    });
                    await ecsClient.send(runTaskCommand);
                    console.log("Task is running");

                    //Delete the message
                    const deleteCommand = new DeleteMessageCommand({
                        QueueUrl: "https://sqs.ap-south-1.amazonaws.com/854326516450/TempRawVideoS3Queue",
                        ReceiptHandle: message.ReceiptHandle
                    });
                    await client.send(deleteCommand);
                    console.log("Message deleted");
                }
            }
        } catch (error) {
            console.error(error);
        }

    }
}

init();