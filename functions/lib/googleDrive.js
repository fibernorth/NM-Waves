"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDrivePhotos = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const googleapis_1 = require("googleapis");
const db = admin.firestore();
/**
 * Callable Cloud Function: lists photos from a shared Google Drive folder.
 * Reads folder ID from appSettings/integrations.
 * Uses service account credentials from Firebase Functions config.
 */
exports.listDrivePhotos = functions.https.onCall(async (_data, context) => {
    var _a, _b, _c;
    // Require authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    // Get integration settings
    const settingsDoc = await db.doc('appSettings/integrations').get();
    const settings = settingsDoc.data();
    if (!((_a = settings === null || settings === void 0 ? void 0 : settings.googleDrive) === null || _a === void 0 ? void 0 : _a.enabled) || !((_b = settings === null || settings === void 0 ? void 0 : settings.googleDrive) === null || _b === void 0 ? void 0 : _b.folderId)) {
        return { photos: [] };
    }
    const folderId = settings.googleDrive.folderId;
    try {
        // Get service account credentials from Firebase Functions config
        const config = functions.config();
        const serviceAccountStr = (_c = config.google_drive) === null || _c === void 0 ? void 0 : _c.service_account;
        if (!serviceAccountStr) {
            console.error('Google Drive service account not configured');
            return { photos: [] };
        }
        const serviceAccount = JSON.parse(serviceAccountStr);
        const auth = new googleapis_1.google.auth.GoogleAuth({
            credentials: serviceAccount,
            scopes: ['https://www.googleapis.com/auth/drive.readonly'],
        });
        const drive = googleapis_1.google.drive({ version: 'v3', auth });
        const response = await drive.files.list({
            q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
            fields: 'files(id, name, thumbnailLink, webContentLink, createdTime, mimeType)',
            orderBy: 'createdTime desc',
            pageSize: 100,
        });
        const photos = (response.data.files || []).map((file) => ({
            id: `drive_${file.id}`,
            name: file.name,
            thumbnailUrl: file.thumbnailLink || undefined,
            fileUrl: file.webContentLink || `https://drive.google.com/uc?id=${file.id}&export=view`,
            createdAt: file.createdTime || new Date().toISOString(),
            source: 'google_drive',
        }));
        return { photos };
    }
    catch (error) {
        console.error('Error listing Drive photos:', error);
        throw new functions.https.HttpsError('internal', 'Failed to list Drive photos');
    }
});
//# sourceMappingURL=googleDrive.js.map