export type SpeciesInfo = {
  id: string; // slug
  scientificName: string;
  commonName: string;
  sequestration?: {
    low?: number; // kg CO2e/yr
    baseline?: number;
    high?: number;
  };
  notes?: string;
};

// Initial curated list; can later be fetched from backend/admin-managed DB
export const SPECIES_LIST: SpeciesInfo[] = [
  { id: 'azadirachta-indica', scientificName: 'Azadirachta indica', commonName: 'Neem' },
  { id: 'ficus-benghalensis', scientificName: 'Ficus benghalensis', commonName: 'Banyan' },
  { id: 'ficus-religiosa', scientificName: 'Ficus religiosa', commonName: 'Peepal' },
  { id: 'mangifera-indica', scientificName: 'Mangifera indica', commonName: 'Mango' },
  { id: 'syzygium-cumini', scientificName: 'Syzygium cumini', commonName: 'Jamun' },
  { id: 'shorea-robusta', scientificName: 'Shorea robusta', commonName: 'Sal' },
  { id: 'tectona-grandis', scientificName: 'Tectona grandis', commonName: 'Teak' },
  { id: 'eucalyptus-spp', scientificName: 'Eucalyptus spp.', commonName: 'Eucalyptus' },
  { id: 'populus-deltoides', scientificName: 'Populus deltoides', commonName: 'Poplar' },
  { id: 'bambusa-balcooa', scientificName: 'Bambusa balcooa', commonName: 'Bamboo' },
];

export const SPECIES_BY_ID = Object.fromEntries(SPECIES_LIST.map(s => [s.id, s]));
