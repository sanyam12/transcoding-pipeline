import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "fs/promises";
import fsOld from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
// const path = require("path");

// const ffmpeg = require("fluent-ffmpeg");


const RESOLUTIONS = [
    { name: "1080p", width: 1920, height: 1080 },
    { name: "720p", width: 1280, height: 720 },
    { name: "480p", width: 854, height: 480 },
    { name: "360p", width: 640, height: 360 },
    { name: "240p", width: 426, height: 240 },
];
const BUCKET = process.env.BUCKET_NAME;
const KEY = process.env.KEY;

async function init() {
    //download video
    console.log("Downloading video");
    const s3Client = new S3Client({ 
        region: "ap-south-1",
        credentials: {
            accessKeyId: process.env.AWS_ACCESS || "",
            secretAccessKey: process.env.SECRET || ""
        }
    });
    const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: KEY,
    });
    const result = await s3Client.send(command);
    const filePath = `original-video.mp4`;
    await fs.writeFile(filePath, result.Body);
    console.log("Video downloaded");

    const originalPath = path.resolve(filePath);

    //start transcoder
    const promises = RESOLUTIONS.map(async (resolution) => {
        const output = `video-${resolution.name}.mp4`;
        console.log(`Converting video to ${resolution.name}`);
        return new Promise((resolve, reject) => {
            ffmpeg(originalPath)
            .output(output)
            .videoCodec("libx264")
            .audioCodec("aac")
            .withSize(`${resolution.width}x${resolution.height}`)
            .format("mp4")
            .on("end", async () => {
                console.log("Transcoding finished");
                const putCommand = new PutObjectCommand({
                    Bucket: `prod.hls.thesanyam.com`,
                    Key: `${KEY}/`+output,
                    Body:
                    await fsOld.createReadStream(output),
                });
                await s3Client.send(putCommand);
                console.log(`Uploaded video-${resolution.name}.mp4`);
                resolve(output);
            })
            .run();
        });
    }); 
    
    const videoFiles = await Promise.all(promises);
}   

console.log("Starting transcoding");
init();




//upload