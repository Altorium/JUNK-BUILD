// cards.js

const cards = {

  cpu: [
    {
      name: "Gore I9",
      cost: 60,
      socket: "[G]",
      score: 8000,
      power: 250,
      reliability: "new",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 9",
      cost: 60,
      socket: "[R]",
      score: 8000,
      power: 200,
      reliability: "new",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I7",
      cost: 45,
      socket: "[G]",
      score: 6000,
      power: 150,
      reliability: "new",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 7",
      cost: 45,
      socket: "[R]",
      score: 6000,
      power: 105,
      reliability: "new",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I5",
      cost: 30,
      socket: "[G]",
      score: 4000,
      power: 65,
      reliability: "new",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 5",
      cost: 30,
      socket: "[R]",
      score: 4000,
      power: 65,
      reliability: "new",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I3",
      cost: 15,
      socket: "[G]",
      score: 2000,
      power: 35,
      reliability: "new",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 3",
      cost: 15,
      socket: "[R]",
      score: 2000,
      power: 35,
      reliability: "new",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I9",
      cost: 42,
      socket: "[G]",
      score: 8000,
      power: 250,
      reliability: "used",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 9",
      cost: 42,
      socket: "[R]",
      score: 8000,
      power: 200,
      reliability: "used",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I7",
      cost: 32,
      socket: "[G]",
      score: 6000,
      power: 150,
      reliability: "used",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 7",
      cost: 32,
      socket: "[R]",
      score: 6000,
      power: 105,
      reliability: "used",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I5",
      cost: 21,
      socket: "[G]",
      score: 4000,
      power: 65,
      reliability: "used",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 5",
      cost: 21,
      socket: "[R]",
      score: 4000,
      power: 65,
      reliability: "used",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I3",
      cost: 11,
      socket: "[G]",
      score: 2000,
      power: 35,
      reliability: "used",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 3",
      cost: 11,
      socket: "[R]",
      score: 2000,
      power: 35,
      reliability: "used",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I9",
      cost: 18,
      socket: "[G]",
      score: 8000,
      power: 250,
      reliability: "junk",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 9",
      cost: 18,
      socket: "[R]",
      score: 8000,
      power: 200,
      reliability: "junk",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I7",
      cost: 14,
      socket: "[G]",
      score: 6000,
      power: 150,
      reliability: "junk",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 7",
      cost: 14,
      socket: "[R]",
      score: 6000,
      power: 105,
      reliability: "junk",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I5",
      cost: 9,
      socket: "[G]",
      score: 4000,
      power: 65,
      reliability: "junk",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 5",
      cost: 9,
      socket: "[R]",
      score: 4000,
      power: 65,
      reliability: "junk",
      type:"cpu",
      brand:"AMD"
    },
    {
      name: "Gore I3",
      cost: 5,
      socket: "[G]",
      score: 2000,
      power: 35,
      reliability: "junk",
      type:"cpu",
      brand:"Intel"
    },
    {
      name: "Rizen 3",
      cost: 5,
      socket: "[R]",
      score: 2000,
      power: 35,
      reliability: "junk",
      type:"cpu",
      brand:"AMD"
    }
  ],

  gpu: [
    {
      name: "Z-Force 90",
      cost: 80,
      score: 9000,
      power: 450,
      reliability: "new",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 900",
      cost: 70,
      score: 8500,
      power: 350,
      reliability: "new",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 70",
      cost: 50,
      score: 6000,
      power: 250,
      reliability: "new",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 700",
      cost: 45,
      score: 5500,
      power: 220,
      reliability: "new",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 60",
      cost: 35,
      score: 3500,
      power: 150,
      reliability: "new",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 600",
      cost: 30,
      score: 3000,
      power: 130,
      reliability: "new",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 50",
      cost: 10,
      score: 2000,
      power: 75,
      reliability: "new",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 500",
      cost: 10,
      score: 2000,
      power: 50,
      reliability: "new",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 90",
      cost: 56,
      score: 9000,
      power: 450,
      reliability: "used",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 900",
      cost: 49,
      score: 8500,
      power: 350,
      reliability: "used",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 70",
      cost: 35,
      score: 6000,
      power: 250,
      reliability: "used",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 700",
      cost: 32,
      score: 5500,
      power: 220,
      reliability: "used",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 60",
      cost: 25,
      score: 3500,
      power: 150,
      reliability: "used",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 600",
      cost: 21,
      score: 3000,
      power: 130,
      reliability: "used",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 50",
      cost: 7,
      score: 2000,
      power: 75,
      reliability: "used",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 500",
      cost: 7,
      score: 2000,
      power: 50,
      reliability: "used",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 90",
      cost: 24,
      score: 9000,
      power: 450,
      reliability: "junk",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 900",
      cost: 21,
      score: 8500,
      power: 350,
      reliability: "junk",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 70",
      cost: 15,
      score: 6000,
      power: 250,
      reliability: "junk",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 700",
      cost: 14,
      score: 5500,
      power: 220,
      reliability: "junk",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 60",
      cost: 11,
      score: 3500,
      power: 150,
      reliability: "junk",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 600",
      cost: 9,
      score: 3000,
      power: 130,
      reliability: "junk",
      type:"gpu",
      brand:"AMD"
    },
    {
      name: "Z-Force 50",
      cost: 3,
      score: 2000,
      power: 75,
      reliability: "junk",
      type:"gpu",
      brand:"NVIDIA"
    },
    {
      name: "Radion 500",
      cost: 3,
      score: 2000,
      power: 50,
      reliability: "junk",
      type:"gpu",
      brand:"AMD"
    }
  ],

  memory: [
    {
      name: "メモリ for gen4 8G",
      cost: 5,
      memoryType: "DDR4",
      capacity: 8,
      reliability: "new",
      type:"memory"
    },
    {
      name: "メモリ for gen4 16G",
      cost: 10,
      memoryType: "DDR4",
      capacity: 16,
      reliability: "new",
      type:"memory"
    },
    {
      name: "メモリ for gen4 32G",
      cost: 20,
      memoryType: "DDR4",
      capacity: 32,
      reliability: "new",
      type:"memory"
    },
    {
      name: "メモリ for gen5 8G",
      cost: 10,
      memoryType: "DDR5",
      capacity: 8,
      reliability: "new",
      type:"memory"
    },
    {
      name: "メモリ for gen5 16G",
      cost: 15,
      memoryType: "DDR5",
      capacity: 16,
      reliability: "new",
      type:"memory"
    },
    {
      name: "メモリ for gen5 32G",
      cost: 25,
      memoryType: "DDR5",
      capacity: 32,
      reliability: "new",
      type:"memory"
    }
  ],

  motherboard: [
    {
      name: "Gore Z-Board",
      cost: 25,
      socket: "[G]",
      memoryType: "DDR5",
      reliability: "new",
      type:"motherboard"
    },
    {
      name: "Rizen X-Board",
      cost: 25,
      socket: "[R]",
      memoryType: "DDR5",
      reliability: "new",
      type:"motherboard"
    },
    {
      name: "Gore B-Board",
      cost: 15,
      socket: "[G]",
      memoryType: "DDR4",
      reliability: "new",
      type:"motherboard"
    },
    {
      name: "Rizen B-Board",
      cost: 15,
      socket: "[R]",
      memoryType: "DDR4",
      reliability: "new",
      type:"motherboard"
    }
  ],
  psu: [
    {
      name: "1200W Platinum",
      cost: 30,
      capacity: 1200,
      rating: "Platinum",
      reliability: "new",
      type:"psu"
    },
    {
      name: "850W Gold",
      cost: 20,
      capacity: 850,
      rating: "Gold",
      reliability: "new",
      type:"psu"
    },
    {
      name: "650W Bronze",
      cost: 10,
      capacity: 650,
      rating: "Bronze",
      reliability: "new",
      type:"psu"
    },
    {
      name: "450W Standard",
      cost: 5,
      capacity: 450,
      rating: "Standard",
      reliability: "new",
      type:"psu"
    }
  ],
  support: [
    {
      name: "RGBケースファン",
      cost: 10,
      effect: "5%プラス", //サポカのここの書き方はどうする？パーセンテージ前提で「5」とか数字だけにする？
      type:"support"
    },
    {
      name: "謎のケースファン",
      cost: 10,
      effect: "さいころをふって1-3なら10%プラス，4-6なら10%マイナス",
      type:"support"
    }
  ]

};

