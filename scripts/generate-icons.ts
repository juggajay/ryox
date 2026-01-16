import sharp from 'sharp';
import { mkdir } from 'fs/promises';

const LOGO_URL = 'https://ryoxcarpentry.wordifysites.com/wp-content/uploads/2015/04/33333.png';
const BG_COLOR = '#0a0a0a';

async function generateIcons() {
  await mkdir('public/icons', { recursive: true });

  console.log('Downloading logo...');
  const response = await fetch(LOGO_URL);
  const buffer = Buffer.from(await response.arrayBuffer());

  const sizes = [
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
  ];

  for (const { size, name } of sizes) {
    console.log(`Generating ${name} (${size}x${size})...`);
    await sharp(buffer)
      .resize(size - 40, size - 40, { fit: 'contain', background: BG_COLOR })
      .extend({
        top: 20, bottom: 20, left: 20, right: 20,
        background: BG_COLOR
      })
      .png()
      .toFile(`public/icons/${name}`);
  }

  console.log('Done! Icons generated in public/icons/');
}

generateIcons().catch(console.error);
