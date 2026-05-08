// Location model — one document per GPS ping.
// Indexed on (deviceId, timestamp) so /history queries stay fast as the collection grows.
import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema(
  {
    deviceId: {
      type: String,
      required: true,
      index: true,
    },
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    speed: {
      type: Number,
      default: 0,
    },
    direction: {
      // Hareket yönü, derece cinsinden — 0=kuzey, 90=doğu, 180=güney, 270=batı.
      // Cihaz hareketsizken null kalabilir (GPS yön hesaplayamıyor).
      type: Number,
      default: null,
      min: 0,
      max: 360,
    },
    city: {
      type: String,
      default: null,
    },
    country: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

locationSchema.index({ deviceId: 1, timestamp: -1 });

const Location = mongoose.model('Location', locationSchema);

export default Location;
