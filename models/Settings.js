const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'site', unique: true },
    topBarText: { type: String, default: 'Envíos a todo Chile · Joyas y accesorios seleccionados con cariño' },
    heroTitle: { type: String, default: 'Joyas delicadas para todos los días' },
    heroSubtitle: { type: String, default: 'ARYA JOYAS Y ACCESORIOS' },
    heroText: { type: String, default: 'Piezas femeninas, luminosas y fáciles de combinar. Elige tu favorita y escríbenos para reservar.' },
    heroImageUrl: { type: String, default: 'https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&w=1200&q=80' },
    aboutTitle: { type: String, default: 'Diseño suave, brillo sutil' },
    aboutText: { type: String, default: 'Creamos una vitrina limpia y elegante para destacar cada pieza sin saturar. Puedes editar este texto desde el administrador.' },
    ctaTitle: { type: String, default: '¿Quieres una pieza especial?' },
    ctaText: { type: String, default: 'Escríbenos por WhatsApp y te ayudamos a escoger, reservar o coordinar entrega.' },
    whatsappNumber: { type: String, default: '56979254260' },
    instagramUrl: { type: String, default: 'https://www.instagram.com/' },
    email: { type: String, default: 'contacto@aryajoyas.cl' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Settings', settingsSchema);
