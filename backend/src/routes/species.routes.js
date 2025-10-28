import express from 'express';

const router = express.Router();

// Temporary in-memory species list. Replace with Mongo-backed model later.
const SPECIES = [
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

router.get('/list', (_req,res)=>{
  const byCommon = [...SPECIES].sort((a,b)=> a.commonName.localeCompare(b.commonName));
  const byScientific = [...SPECIES].sort((a,b)=> a.scientificName.localeCompare(b.scientificName));
  res.json({ items: SPECIES, byCommon, byScientific, count: SPECIES.length });
});

export default router;
