
import { google } from 'googleapis';
console.log('Syncing Drive... Set DRIVE_ROOT_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_JSON');
console.log('This script crawls Drive and upserts folders/files into Postgres');
// Full implementation in deploy guide - BFS crawl with driveFileId as unique key
