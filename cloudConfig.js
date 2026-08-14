const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_API,
    api_secret: process.env.CLOUD_API_SECRET
})

module.exports = {
    cloudinary,
    storage: new CloudinaryStorage({
        cloudinary,
        params: {
            folder: 'F1_audio_upload',
            allowed_formats: ['mp3', 'm4a', 'wav'],
            resource_type: 'auto'
        }
    })
}