import { v2 as cloudinary, type UploadApiResponse } from 'cloudinary';

// Описание файла во внешнем хранилище:
type StoredFile = {
  url: string;
  storageKey: string | null;
};

// Читает обязательные настройки Cloudinary:
function readCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME; // Cloud name
  const apiKey = process.env.CLOUDINARY_API_KEY; // API Key
  const apiSecret = process.env.CLOUDINARY_API_SECRET; // API Secret

  if (!cloudName || !apiKey || !apiSecret) return null;

  return { cloudName, apiKey, apiSecret };
}

// Настраивает официальный SDK Cloudinary:
function configureCloudinary() {
  const config = readCloudinaryConfig(); // Настройки сервиса
  if (!config) return false;

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  }); // Подключение к Cloudinary

  return true;
}

// Проверяет, подключено ли внешнее хранилище:
export function hasObjectStorage() {
  return Boolean(readCloudinaryConfig());
}

// Загружает новый файл в Cloudinary либо сохраняет fallback для разработки:
export async function storeMediaFile(
  file: Express.Multer.File,
  userId: string,
  excursionId: string
): Promise<StoredFile> {
  const configured = configureCloudinary(); // Готовность Cloudinary

  // На опубликованном сервере медиа должно храниться вне PostgreSQL:
  if (!configured && process.env.NODE_ENV === 'production') {
    throw new Error('Cloudinary is not configured');
  }

  // В локальной разработке и тестах остается совместимый data URL:
  if (!configured) {
    return {
      url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      storageKey: null,
    };
  }

  // Передает буфер файла напрямую в Cloudinary:
  const result = await new Promise<UploadApiResponse>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `constructor/${userId}/${excursionId}`,
        resource_type: 'auto',
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, uploadResult) => {
        if (error || !uploadResult) {
          reject(error || new Error('Cloudinary upload failed'));
          return;
        }

        resolve(uploadResult); // Данные загруженного файла
      }
    );

    uploadStream.end(file.buffer); // Содержимое файла
  });

  return {
    url: result.secure_url,
    storageKey: `${result.resource_type}:${result.public_id}`,
  }; // Ссылка и ключ удаления
}

// Удаляет файл из Cloudinary, если он был сохранен там:
export async function removeStoredMedia(storageKey: string | null | undefined) {
  if (!configureCloudinary() || !storageKey) return; // Старые data URL не имеют ключа

  const [resourceType, ...publicIdParts] = storageKey.split(':'); // Тип и public id
  const publicId = publicIdParts.join(':'); // Полный public id
  if (!publicId) return;

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType as 'image' | 'video' | 'raw',
    invalidate: true,
  }); // Удаление объекта
}
