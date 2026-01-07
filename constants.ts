
import { Injector } from './types';

export const INITIAL_INJECTORS: Injector[] = [
  {
    id: '1',
    brand: 'Toyota',
    model: 'Corolla 1.8 1ZZ-FE',
    sku: '23250-22040',
    price: 45,
    stock: 24,
    description: 'Inyector de alta precisión original para motores Toyota 1.8L.',
    specifications: {
      'Caudal': '250cc',
      'Resistencia': '12.5 Ohms',
      'Tipo': 'Top Feed',
      'Huecos': '12'
    },
    images: [
      'https://picsum.photos/seed/toyota1/800/600', 
      'https://picsum.photos/seed/toyota2/800/600',
      'https://picsum.photos/seed/toyota3/800/600'
    ],
    mlLink: 'https://www.mercadolibre.com'
  },
  {
    id: '2',
    brand: 'Chevrolet',
    model: 'Aveo 1.6 / Optra Design',
    sku: '96332261',
    price: 35,
    stock: 12,
    description: 'Inyector para motor E-Tech II 1.6L.',
    specifications: {
      'Caudal': '180cc',
      'Resistencia': '14.0 Ohms',
      'Agujeros': '4'
    },
    images: [
      'https://picsum.photos/seed/chevy1/800/600',
      'https://picsum.photos/seed/chevy2/800/600',
      'https://picsum.photos/seed/chevy3/800/600'
    ],
    mlLink: 'https://www.mercadolibre.com'
  },
  {
    id: '3',
    brand: 'Ford',
    model: 'Explorer 4.0 V6',
    sku: '0280158055',
    price: 55,
    stock: 8,
    description: 'Inyector genuino para Explorer 2006-2010.',
    specifications: {
      'Caudal': '210cc',
      'Resistencia': '12.0 Ohms',
      'Huecos': '4'
    },
    images: [
      'https://picsum.photos/seed/ford1/800/600',
      'https://picsum.photos/seed/ford2/800/600',
      'https://picsum.photos/seed/ford3/800/600'
    ],
    mlLink: 'https://www.mercadolibre.com'
  }
];

export const WAZE_URL = 'https://waze.com/ul?ll=10.4806,-66.9036&navigate=yes'; // Sample Caracas coord
