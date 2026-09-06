import path from 'path'
import { fileURLToPath } from 'url'

import type { CollectionConfig } from 'payload'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    // Files are streamed through Payload rather than served from the bucket
    // directly, so this is what makes uploads publicly readable.
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
    },
  ],
  upload: {
    // Only used when no S3 bucket is configured, i.e. local development.
    staticDir: path.resolve(dirname, '../../media'),
  },
}
