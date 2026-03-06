// cards.js

const cards = {

  cpu: [
    {
      name: "Ryzen 5 5600X",
      cost: 30000,
      socket: "AM4",
      score: 650,
      power: 65,
      reliability: "new"
    },
    {
      name: "Core i7 13700K",
      cost: 50000,
      socket: "LGA1700",
      score: 850,
      power: 125,
      reliability: "new"
    },
    {
      name: "中古 Ryzen 7 3700X",
      cost: 20000,
      socket: "AM4",
      score: 600,
      power: 65,
      reliability: "used"
    }
  ],

  gpu: [
    {
      name: "RTX 4060",
      cost: 45000,
      score: 700,
      power: 115,
      reliability: "new"
    },
    {
      name: "RTX 3080（中古）",
      cost: 50000,
      score: 900,
      power: 320,
      reliability: "used"
    },
    {
      name: "GTX 1660",
      cost: 25000,
      score: 450,
      power: 120,
      reliability: "new"
    }
  ],

  memory: [
    {
      name: "16GB DDR4",
      cost: 8000,
      memoryType: "DDR4",
      capacity: 16,
      reliability: "new"
    },
    {
      name: "32GB DDR4",
      cost: 15000,
      memoryType: "DDR4",
      capacity: 32,
      reliability: "new"
    },
    {
      name: "16GB DDR5",
      cost: 12000,
      memoryType: "DDR5",
      capacity: 16,
      reliability: "used"
    }
  ],

  motherboard: [
    {
      name: "B550",
      cost: 15000,
      socket: "AM4",
      memoryType: "DDR4",
      reliability: "new"
    },
    {
      name: "Z690",
      cost: 25000,
      socket: "LGA1700",
      memoryType: "DDR5",
      reliability: "new"
    }
  ],

  psu: [
    {
      name: "600W Bronze",
      cost: 8000,
      capacity: 600,
      rating: "Bronze",
      reliability: "new"
    },
    {
      name: "750W Gold",
      cost: 12000,
      capacity: 750,
      rating: "Gold",
      reliability: "new"
    }
  ]
};
