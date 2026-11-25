// Game constants and help text. Source of truth: the Rules-Sheet in BUILD-PLAN.md.

export const TYPES = ["Fire","Wind","Poison","Ghost (shadow)","Ice","Food","Water","Ground","Plant","Plasma","Alien","Celestial","Angel","Stormy cloud","Bone","Glitch","Music","Swamp","Sand","Time","Crystal"];

export const ADV = [["Water","Fire"],["Fire","Ice"],["Fire","Swamp"],["Sand","Ice"],["Alien","Stormy cloud"],["Ghost (shadow)","Poison"]];

// name, color word, swatch, health, shop price
export const RAR = [
  ["Common","green","#3e8e3a",500,100],
  ["Uncommon","blue","#2d6cd0",600,200],
  ["Rare","purple","#7a4fd2",700,300],
  ["Legendary","golden yellow","#e3b324",800,400],
  ["Mythical","red","#c4302e",900,500],
  ["Extreme","red and purple","linear-gradient(135deg,#c4302e 0 50%,#7a4fd2 50% 100%)",1000,600],
  ["Divine","orange","#ec7a18",1100,700]
];

export const STYLE_BLOCK = "Finished in color. Each monster is realistic or cartoony, and the designer picks which one. Cartoony monsters get a thin black cartoon outline. Keep the same shapes and details as the original drawing, with color added and a little shading. Monsters can be any color, and each monster uses the colors the designer picks for it. The overall feel is half dark, half bright. Monsters look scary-ish.";

// Drawing pad swatches
export const SWATCHES = [
  ["Black","#111111"],["Gray","#8a8a94"],["Purple","#7a3fc4"],["Indigo","#3f2fa0"],
  ["Dark blue","#16307a"],["Sky blue","#4cb8f0"],["Red","#d02a2a"],["Orange","#f08a1c"],
  ["Golden yellow","#e9b61c"],["Green","#2f9a3f"],["Brown","#7a4a25"],["Pink","#f06aa8"],["White","#ffffff"]
];

// Quick color words for the quiz
export const COLOR_WORDS = [
  ["black","#111111"],["gray","#8a8a94"],["white","#ffffff"],["red","#d02a2a"],["orange","#f08a1c"],
  ["golden yellow","#e9b61c"],["green","#2f9a3f"],["blue","#2d6cd0"],["sky blue","#4cb8f0"],
  ["purple","#7a3fc4"],["pink","#f06aa8"],["brown","#7a4a25"]
];

// Help cards. Short numbered steps, his words.
export const HELP = {
  roster: {
    title: "Your monsters",
    steps: ["Tap a card to open that monster.", "Tap + New monster to start a new one.", "The pill under a card says which draft it is on, or Locked.", "Tap the ? on any screen to get help."]
  },
  monster: {
    title: "A monster's page",
    steps: ["Tap Start a quiz to answer questions about your monster.", "Tap Add a draft to add a new picture.", "Tap a draft box to see that draft on the card.", "Tap the ? by the card to see what each part means."]
  },
  quiz: {
    title: "The quiz",
    steps: ["Read the question. Pick an answer or type one.", "Tap Next to go on.", "Tap Not decided yet if you want to think about it.", "Tap Back to change an answer."]
  },
  adddraft: {
    title: "Add a draft",
    steps: ["Pick one of the three ways.", "Draw it here: draw with your pencil.", "Take a photo: take a picture of your paper drawing.", "Pick a picture: choose a picture you saved."]
  },
  draw: {
    title: "The drawing pad",
    steps: ["Draw with your pencil. Pick a color and a brush size.", "Tap Undo if you make a mistake.", "Tap Eraser to rub something out.", "Tap Save when you are done. It becomes the next draft."]
  },
  rules: {
    title: "The rules page",
    steps: ["This page tells how Monster Brawl works.", "You can only read it here.", "The example round at the bottom shows one fight."]
  },
  prompt: {
    title: "The image prompt",
    steps: ["Tap Copy prompt.", "Paste it into the image tool.", "Upload the newest draft as the reference picture.", "Check that both word counts are green."]
  },
  parent: {
    title: "The grown-up area",
    steps: ["Back up my monsters saves everything in one file.", "Use the share button to save it to Files or send it by AirDrop.", "Restore from backup replaces everything with the file you pick.", "Do a backup every week."]
  },
  card: {
    title: "What is on the card",
    steps: [],
    legend: [
      ["Name", "At the top left."],
      ["Type and height", "In small letters at the top right."],
      ["Moves", "Three strips on the left. The number is the damage. The name comes after it."],
      ["Health", "The heart at the bottom left. A rarer monster has more."],
      ["Rarity", "The word at the bottom right. Its color is the frame around the card."],
      ["Draft stamp", "Says which draft you are looking at. It goes away when the monster is locked."]
    ]
  }
};

// First-time cards
export const TIPS = {
  draw: { title: "First time drawing?", steps: ["Draw with your Apple Pencil. Your hand will not leave marks.", "Pick a color on the left, then a brush size.", "Tap Undo to take back a line.", "Tap Save when you are done."] },
  adddraft: { title: "First time adding a draft?", steps: ["A draft is one picture of your monster.", "Pick one of the three ways below.", "Add a short note so you remember what changed."] },
  card: { title: "This is your monster's card", steps: ["The picture is your latest draft.", "Tap the ? by the card to see what each part is."] }
};
