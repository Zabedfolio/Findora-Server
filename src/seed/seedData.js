import mongoose from "mongoose";
import dotenv from "dotenv";
import Item from "../models/item.model.js";
import Claim from "../models/claim.model.js";
import Handover from "../models/handover.model.js";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not defined in environment variables (.env).");
  process.exit(1);
}

// Better-Auth verified password hash for 'DemoPass123!'
const DEMO_PASSWORD_HASH =
  "d580eac045cd78f4f7fff4d10ff86510:fd0ea5f038390cc2c4c62de277fa0079498b60e35b1514c01d7dd76daf5d783c90f1dcd8d8843e602d9ad59decd7655bdb7b47b46004a49e8c945ce201e95f5e";

export const DEMO_USERS = [
  {
    _id: "usr_demo_01",
    name: "Alex Rivera",
    email: "demo.alex@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_02",
    name: "Tariqul Islam",
    email: "demo.tariq@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_03",
    name: "Sarah Jenkins",
    email: "demo.sarah@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_04",
    name: "Rahim Chowdhury",
    email: "demo.rahim@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_05",
    name: "Farhana Yasmin",
    email: "demo.farhana@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_06",
    name: "Nafis Fuad",
    email: "demo.nafis@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_07",
    name: "Kamrul Hasan",
    email: "demo.kamrul@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_08",
    name: "Nusrat Jahan",
    email: "demo.nusrat@findora.app",
    role: "user",
    flagged: false,
    image: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_09",
    name: "Tanvir Hasan (Suspicious)",
    email: "demo.suspicious@findora.app",
    role: "user",
    flagged: true,
    image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&auto=format&fit=crop&q=80",
  },
  {
    _id: "usr_demo_10",
    name: "Spam Claimant (Flagged)",
    email: "demo.spammer@findora.app",
    role: "user",
    flagged: true,
    image: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80",
  },
];

export async function runSeeder() {
  try {
    console.log("Connecting to MongoDB Atlas...");
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;
    console.log("Connected successfully to DB:", db.databaseName);

    // 1. Seed the 10 Demo Users into Better-Auth 'user' and 'account' collections
    console.log("Upserting 10 Demo Users into user & account collections...");
    for (const u of DEMO_USERS) {
      await db.collection("user").updateOne(
        { email: u.email },
        {
          $set: {
            name: u.name,
            email: u.email,
            emailVerified: true,
            image: u.image,
            role: u.role,
            flagged: u.flagged,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: u._id,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );

      // Upsert password credentials into account collection
      await db.collection("account").updateOne(
        { accountId: u._id, providerId: "credential" },
        {
          $set: {
            password: DEMO_PASSWORD_HASH,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            _id: `acc_${u._id}`,
            accountId: u._id,
            providerId: "credential",
            userId: u._id,
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }
    console.log("✅ 10 Demo Users seeded with password 'DemoPass123!' and flagged status.");

    // 2. Clear previous demo seed data in Item, Claim, Handover (preserving user-created documents)
    await Item.deleteMany({ "postedBy.userId": { $in: DEMO_USERS.map((u) => u._id) } });
    await Claim.deleteMany({ "claimant.userId": { $in: DEMO_USERS.map((u) => u._id) } });
    await Handover.deleteMany({ "owner.userId": { $in: DEMO_USERS.map((u) => u._id) } });

    // 3. Seed 12 Lost Items
    console.log("Seeding 12 Lost Items...");
    const lostDocs = [
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110001"),
        type: "lost",
        title: "Apple iPhone 15 Pro (Natural Titanium)",
        description: "Lost inside coffee shop near Dhanmondi Lake. Phone is enclosed in a clear MagSafe case with a tiny scratch near USB-C port.",
        category: "Electronics",
        location: "Dhanmondi Lake Park, Dhaka",
        date: new Date(Date.now() - 3600000 * 2),
        images: ["https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          image: DEMO_USERS[0].image,
        },
        contact: { phone: "+880 1711-112233", preferredMethod: "phone" },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110002"),
        type: "lost",
        title: "Golden Retriever Puppy with Red Collar",
        description: "Playful 4-month-old puppy went missing around Sector 7 park. Wears a red nylon collar with bell. Responds to 'Simba'.",
        category: "Pets & Animals",
        location: "Uttara Sector 7, Lake View, Dhaka",
        date: new Date(Date.now() - 86400000),
        images: ["https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          image: DEMO_USERS[4].image,
        },
        contact: { phone: "+880 1819-223344", preferredMethod: "phone" },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110003"),
        type: "lost",
        title: "North Face Borealis Backpack (Matte Black)",
        description: "Left on transit bus near Mohakhali. Contains course notes, water bottle, and Dell wireless mouse.",
        category: "Bags & Luggage",
        location: "Mohakhali Wireless Gate Bus Stop, Dhaka",
        date: new Date(Date.now() - 86400000 * 3),
        images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          image: DEMO_USERS[3].image,
        },
        contact: { phone: "+880 1912-334455", preferredMethod: "email" },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110004"),
        type: "lost",
        title: "Sony WH-1000XM5 Wireless Headphones",
        description: "Black wireless noise-canceling headphones inside original zip case. Forgotten on table in Banani cafe.",
        category: "Electronics",
        location: "Banani 11 Shopping Area, Dhaka",
        date: new Date(Date.now() - 86400000 * 4),
        images: ["https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_07",
          name: "Kamrul Hasan",
          email: "demo.kamrul@findora.app",
          image: DEMO_USERS[6].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110005"),
        type: "lost",
        title: "Leather Long Wallet with Bangladesh NID",
        description: "Dark brown bifold wallet containing Smart National ID, Brac Bank debit card, and cash.",
        category: "Documents & Wallets",
        location: "Bashundhara R/A Gate 1, Dhaka",
        date: new Date(Date.now() - 86400000 * 5),
        images: ["https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          image: DEMO_USERS[0].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110006"),
        type: "lost",
        title: "Honda Vezel Smart Key Fob with Leather Strap",
        description: "Key fob with 3 buttons and small silver carabiner clip lost near Gulshan circle.",
        category: "Keys & Access",
        location: "Gulshan 1 Circle, Dhaka",
        date: new Date(Date.now() - 86400000 * 6),
        images: ["https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_07",
          name: "Kamrul Hasan",
          email: "demo.kamrul@findora.app",
          image: DEMO_USERS[6].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110007"),
        type: "lost",
        title: "MacBook Pro 14-inch Space Gray M2",
        description: "Laptop in navy felt sleeve with company stickers on lid. Forgotten in public library study hall.",
        category: "Electronics",
        location: "Dhanmondi 27 Library, Dhaka",
        date: new Date(Date.now() - 86400000 * 7),
        images: ["https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_03",
          name: "Sarah Jenkins",
          email: "demo.sarah@findora.app",
          image: DEMO_USERS[2].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110008"),
        type: "lost",
        title: "Ray-Ban Clubmaster Prescription Glasses",
        description: "Tortoiseshell frame with gold rims inside black Ray-Ban hard shell case.",
        category: "Clothing & Accessories",
        location: "Mirpur 10 Metro Station, Dhaka",
        date: new Date(Date.now() - 86400000 * 8),
        images: ["https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          image: DEMO_USERS[5].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110009"),
        type: "lost",
        title: "Persian Cat with Fluffy White Fur & Green Eyes",
        description: "Beloved adult female Persian cat named 'Mimi' slipped out from balcony.",
        category: "Pets & Animals",
        location: "Baridhara DOHS, Dhaka",
        date: new Date(Date.now() - 86400000 * 10),
        images: ["https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_08",
          name: "Nusrat Jahan",
          email: "demo.nusrat@findora.app",
          image: DEMO_USERS[7].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110010"),
        type: "lost",
        title: "Samsonite Cabin Trolley Bag (Off-White)",
        description: "Hard shell trolley bag with TSA lock combination. Lost during airport pickup.",
        category: "Bags & Luggage",
        location: "Hazrat Shahjalal Airport Terminal 1, Dhaka",
        date: new Date(Date.now() - 86400000 * 12),
        images: ["https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_03",
          name: "Sarah Jenkins",
          email: "demo.sarah@findora.app",
          image: DEMO_USERS[2].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110011"),
        type: "lost",
        title: "Seiko 5 Automatic Watch with Brown Leather Strap",
        description: "Vintage dial with day/date window at 3 o'clock. Family heirloom timepiece.",
        category: "Jewelry & Watches",
        location: "Motijheel Commercial Area, Dhaka",
        date: new Date(Date.now() - 86400000 * 14),
        images: ["https://images.unsplash.com/photo-1524805444758-089113d48a6d?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          image: DEMO_USERS[4].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e11111111111111110012"),
        type: "lost",
        title: "Graduation Certificate & University Transcripts Folder",
        description: "Blue hardcover portfolio containing BSc in Computer Science certificates from DU.",
        category: "Documents & Wallets",
        location: "Shahbagh Public Library Road, Dhaka",
        date: new Date(Date.now() - 86400000 * 15),
        images: ["https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          image: DEMO_USERS[3].image,
        },
      },
    ];

    const insertedLost = await Item.insertMany(lostDocs);
    console.log(`✅ ${insertedLost.length} Lost Items seeded.`);

    // 4. Seed 12 Found Items
    console.log("Seeding 12 Found Items...");
    const foundDocs = [
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220001"),
        type: "found",
        title: "Black Leather Bifold Wallet with City Transit Pass",
        description: "Found on concourse bench at City Center Metro Station. Safely deposited with station staff.",
        category: "Documents & Wallets",
        location: "City Center Metro Station, Gulshan, Dhaka",
        date: new Date(Date.now() - 3600000 * 5),
        images: ["https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          image: DEMO_USERS[1].image,
        },
        contact: { phone: "+880 1819-234567", preferredMethod: "phone" },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220002"),
        type: "found",
        title: "Toyota Smart Key with Blue Leather Fob",
        description: "Found in shopping mall parking lot level B2. Key has a small brass ring attached.",
        category: "Keys & Access",
        location: "Banani 11 Shopping Area, Dhaka",
        date: new Date(Date.now() - 86400000),
        images: ["https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          image: DEMO_USERS[5].image,
        },
        contact: { phone: "+880 1912-334455", preferredMethod: "phone" },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220003"),
        type: "found",
        title: "Apple AirPods Pro 2 Case (Engraved with 'Z')",
        description: "Found at coffee shop counter in Bashundhara. Both earbuds present and charging.",
        category: "Electronics",
        location: "North End Coffee Shop, Bashundhara R/A, Dhaka",
        date: new Date(Date.now() - 86400000 * 2),
        images: ["https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          image: DEMO_USERS[1].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220004"),
        type: "found",
        title: "Casio Vintage Digital Watch with Gold Stainless Mesh",
        description: "Found on restaurant washroom sink counter. Screen displays accurate Dhaka time.",
        category: "Jewelry & Watches",
        location: "Gulshan 2 Plaza Concourse, Dhaka",
        date: new Date(Date.now() - 86400000 * 3),
        images: ["https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_08",
          name: "Nusrat Jahan",
          email: "demo.nusrat@findora.app",
          image: DEMO_USERS[7].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220005"),
        type: "found",
        title: "iPad Air 5th Gen (Starlight) with Magnetic Apple Pencil",
        description: "Left on university library study desk level 4. Currently powered on and waiting owner pin.",
        category: "Electronics",
        location: "Dhaka University Central Library, Dhaka",
        date: new Date(Date.now() - 86400000 * 4),
        images: ["https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          image: DEMO_USERS[3].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220006"),
        type: "found",
        title: "Navy Blue Sport Duffel Bag with Gym Clothes",
        description: "Nike gym duffel found on bench near Dhanmondi Rabindra Sarobar.",
        category: "Bags & Luggage",
        location: "Dhanmondi Lake Amphitheater, Dhaka",
        date: new Date(Date.now() - 86400000 * 5),
        images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          image: DEMO_USERS[1].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220007"),
        type: "found",
        title: "Set of 4 House Keys on Eiffel Tower Keychain",
        description: "Brass keys found on pathway near park gate. Includes one padlock key and security fob.",
        category: "Keys & Access",
        location: "Ramna Park Jogging Track, Dhaka",
        date: new Date(Date.now() - 86400000 * 6),
        images: ["https://images.unsplash.com/photo-1582139329536-e7284fece509?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          image: DEMO_USERS[5].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220008"),
        type: "found",
        title: "Silver Pandora Charm Bracelet with Heart Clasp",
        description: "Delicate 925 sterling silver charm bracelet with 3 charms found in fitting room.",
        category: "Jewelry & Watches",
        location: "Bashundhara City Mall Level 3, Dhaka",
        date: new Date(Date.now() - 86400000 * 7),
        images: ["https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_08",
          name: "Nusrat Jahan",
          email: "demo.nusrat@findora.app",
          image: DEMO_USERS[7].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220009"),
        type: "found",
        title: "Kindle Paperwhite 11th Gen (Black Cover)",
        description: "Found on table at Gloria Jean's Coffee. Screen shows lock screen book cover.",
        category: "Electronics",
        location: "Gulshan 1 Avenue, Dhaka",
        date: new Date(Date.now() - 86400000 * 8),
        images: ["https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          image: DEMO_USERS[1].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220010"),
        type: "found",
        title: "Grey Knit Winter Cardigan (Zara Men Size L)",
        description: "Left on chair at rooftop restaurant. Clean and undamaged condition.",
        category: "Clothing & Accessories",
        location: "Dhanmondi 8A Dining Hub, Dhaka",
        date: new Date(Date.now() - 86400000 * 9),
        images: ["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          image: DEMO_USERS[3].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220011"),
        type: "found",
        title: "Black Crossbody Camera Bag with SD Cards",
        description: "Contains three SanDisk 64GB Extreme SD cards and lens cleaning cloth.",
        category: "Bags & Luggage",
        location: "National Museum Entrance, Shahbagh, Dhaka",
        date: new Date(Date.now() - 86400000 * 11),
        images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          image: DEMO_USERS[5].image,
        },
      },
      {
        _id: new mongoose.Types.ObjectId("671e22222222222222220012"),
        type: "found",
        title: "Canadian Permanent Resident Card & Photo ID",
        description: "Document found inside envelope near passport office. Safely held for rightful holder.",
        category: "Documents & Wallets",
        location: "Agargaon Passport Office Gate, Dhaka",
        date: new Date(Date.now() - 86400000 * 13),
        images: ["https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80"],
        status: "active",
        postedBy: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          image: DEMO_USERS[1].image,
        },
      },
    ];

    const insertedFound = await Item.insertMany(foundDocs);
    console.log(`✅ ${insertedFound.length} Found Items seeded.`);

    // 5. Seed 12 Claims connecting demo users as claimants & finders
    console.log("Seeding 12 Claims...");
    const claimDocs = [
      {
        claimNumber: "CLM-824101",
        reportId: insertedFound[0]._id, // Black Leather Wallet
        itemTitle: insertedFound[0].title,
        itemThumbnail: insertedFound[0].images[0],
        category: "Documents & Wallets",
        location: insertedFound[0].location,
        status: "approved",
        statusLabel: "Approved - Ready for Handover",
        statusDescription: "Finder verified your ownership claim! Safe handover ready.",
        claimant: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          avatar: DEMO_USERS[0].image,
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
        },
        claimantProof: {
          description: "Smart NID inside ends in digits 3821. Left fold contains blue transit card with my photo.",
          proofPhotoUrl: "",
          submittedAt: new Date(Date.now() - 86400000),
        },
        reviewNotes: "Finder checked the NID digits and confirmed they match exactly.",
        timeline: [
          { step: 1, title: "Claim Submitted", time: "Yesterday", description: "Proof of ownership submitted.", completed: true },
          { step: 2, title: "Claim Approved", time: "Just now", description: "Finder authorized handover.", completed: true, current: true },
        ],
        handover: {
          isEligible: true,
          status: "ready",
          handoverCode: "FP-8492",
          locationName: "Dhanmondi Police Station, Main Lobby",
          timeSlot: "Tomorrow, 04:30 PM",
        },
      },
      {
        claimNumber: "CLM-824102",
        reportId: insertedFound[1]._id, // Toyota Smart Key
        itemTitle: insertedFound[1].title,
        itemThumbnail: insertedFound[1].images[0],
        category: "Keys & Access",
        location: insertedFound[1].location,
        status: "pending",
        statusLabel: "Under Review",
        statusDescription: "Finder is reviewing proof details.",
        claimant: {
          userId: "usr_demo_07",
          name: "Kamrul Hasan",
          email: "demo.kamrul@findora.app",
          avatar: DEMO_USERS[6].image,
        },
        finder: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          phone: "+880 1912-334455",
          avatar: DEMO_USERS[5].image,
        },
        claimantProof: {
          description: "Key fob has an engraved miniature initial 'K.H.' on the reverse side clip.",
          submittedAt: new Date(Date.now() - 3600000 * 4),
        },
        timeline: [
          { step: 1, title: "Claim Submitted", time: "4 hours ago", description: "Proof submitted to finder.", completed: true, current: true },
        ],
      },
      {
        claimNumber: "CLM-824103",
        reportId: insertedFound[2]._id, // AirPods Pro 2 Case
        itemTitle: insertedFound[2].title,
        itemThumbnail: insertedFound[2].images[0],
        category: "Electronics",
        location: insertedFound[2].location,
        status: "reunited",
        statusLabel: "Reunited & Returned",
        statusDescription: "Item was successfully handed over and both parties verified exchange.",
        claimant: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          avatar: DEMO_USERS[0].image,
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
        },
        claimantProof: {
          description: "Laser engraved letter 'Z' centered on front lid; left earbud serial ends in H92K.",
          submittedAt: new Date(Date.now() - 86400000 * 3),
        },
        reviewNotes: "All markings match physical case. Handover conducted at North End Coffee.",
        timeline: [
          { step: 1, title: "Claim Submitted", time: "3 days ago", description: "Proof submitted.", completed: true },
          { step: 2, title: "Claim Approved", time: "2 days ago", description: "Finder confirmed proof.", completed: true },
          { step: 3, title: "Reunited & Returned", time: "Yesterday", description: "Two-party exchange verified.", completed: true, current: true },
        ],
      },
      {
        claimNumber: "CLM-824104",
        reportId: insertedFound[7]._id, // Pandora Bracelet
        itemTitle: insertedFound[7].title,
        itemThumbnail: insertedFound[7].images[0],
        category: "Jewelry & Watches",
        location: insertedFound[7].location,
        status: "approved",
        statusLabel: "Approved - Ready for Handover",
        statusDescription: "Finder verified identifying charms.",
        claimant: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          avatar: DEMO_USERS[4].image,
        },
        finder: {
          userId: "usr_demo_08",
          name: "Nusrat Jahan",
          email: "demo.nusrat@findora.app",
          avatar: DEMO_USERS[7].image,
        },
        claimantProof: {
          description: "One charm is an infinity heart, second is a graduation cap, third is a teal Murano glass bead.",
          submittedAt: new Date(Date.now() - 86400000 * 2),
        },
        timeline: [
          { step: 1, title: "Claim Submitted", time: "2 days ago", description: "Charms described.", completed: true },
          { step: 2, title: "Claim Approved", time: "Today", description: "Charms matched item.", completed: true, current: true },
        ],
      },
      {
        claimNumber: "CLM-824105",
        reportId: insertedFound[4]._id, // iPad Air
        itemTitle: insertedFound[4].title,
        itemThumbnail: insertedFound[4].images[0],
        category: "Electronics",
        location: insertedFound[4].location,
        status: "rejected",
        statusLabel: "Verification Declined",
        statusDescription: "Submitted passcode did not unlock the iPad. Proof did not match.",
        claimant: {
          userId: "usr_demo_10", // Flagged spam user
          name: "Spam Claimant (Flagged)",
          email: "demo.spammer@findora.app",
          avatar: DEMO_USERS[9].image,
        },
        finder: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          avatar: DEMO_USERS[3].image,
        },
        claimantProof: {
          description: "Generic iPad, mine had a cat wallpaper. Unlock code 1234.",
          submittedAt: new Date(Date.now() - 86400000 * 2),
        },
        reviewNotes: "Passcode did not unlock device. Wallpaper is mountain scenery, not a cat.",
        timeline: [
          { step: 1, title: "Claim Submitted", time: "2 days ago", description: "Proof submitted.", completed: true },
          { step: 2, title: "Claim Declined", time: "Yesterday", description: "Verification details failed.", completed: true, current: true },
        ],
      },
      {
        claimNumber: "CLM-824106",
        reportId: insertedFound[5]._id, // Titanium Prescription Glasses
        itemTitle: insertedFound[5].title,
        itemThumbnail: insertedFound[5].images[0],
        category: "Clothing & Accessories",
        location: insertedFound[5].location,
        status: "approved",
        statusLabel: "Approved - Ready for Handover",
        statusDescription: "Finder verified prescription power details match the tag.",
        claimant: {
          userId: "usr_demo_07",
          name: "Kamrul Hasan",
          email: "demo.kamrul@findora.app",
          avatar: DEMO_USERS[6].image,
        },
        finder: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          phone: "+880 1912-334455",
          avatar: DEMO_USERS[5].image,
        },
        claimantProof: {
          description: "Black titanium frame, Ray-Ban RB8415, left lens -2.50, right -2.75.",
          submittedAt: new Date(Date.now() - 86400000 * 2),
        },
        reviewNotes: "Frame model and prescription match the card found inside case.",
        timeline: [
          { step: 1, title: "Claim Submitted", time: "2 days ago", description: "Prescription card uploaded.", completed: true },
          { step: 2, title: "Claim Approved", time: "Yesterday", description: "Finder verified details.", completed: true, current: true },
        ],
        handover: {
          isEligible: true,
          status: "ready",
          handoverCode: "FP-9102",
          locationName: "Star Kabab Dhanmondi 2",
          timeSlot: "Tomorrow, 01:30 PM",
        },
      },
      {
        claimNumber: "CLM-824107",
        reportId: insertedFound[6]._id, // HP Charger
        itemTitle: insertedFound[6].title,
        itemThumbnail: insertedFound[6].images[0],
        category: "Electronics",
        location: insertedFound[6].location,
        status: "pending",
        statusLabel: "Under Review",
        statusDescription: "Finder is reviewing serial number details.",
        claimant: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          avatar: DEMO_USERS[3].image,
        },
        finder: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          avatar: DEMO_USERS[4].image,
        },
        claimantProof: {
          description: "65W USB-C blue-tip adapter with small red tape on power brick.",
          submittedAt: new Date(Date.now() - 3600000 * 8),
        },
        timeline: [
          { step: 1, title: "Claim Submitted", time: "8 hours ago", description: "Physical description submitted.", completed: true, current: true },
        ],
      },
      {
        claimNumber: "CLM-824108",
        reportId: insertedFound[8]._id, // Sony Headphones
        itemTitle: insertedFound[8].title,
        itemThumbnail: insertedFound[8].images[0],
        category: "Electronics",
        location: insertedFound[8].location,
        status: "approved",
        statusLabel: "Approved - Safe Handover Active",
        statusDescription: "Bluetooth MAC address and headphone serial matched invoice.",
        claimant: {
          userId: "usr_demo_03",
          name: "Sarah Jenkins",
          email: "demo.sarah@findora.app",
          avatar: DEMO_USERS[2].image,
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
        },
        claimantProof: {
          description: "Sony WH-1000XM4 Silver edition with custom yellow AUX cable inside travel zip.",
          submittedAt: new Date(Date.now() - 86400000 * 3),
        },
        reviewNotes: "Invoice serial matched headphone hinge number.",
        timeline: [
          { step: 1, title: "Claim Submitted", time: "3 days ago", description: "Receipt attached.", completed: true },
          { step: 2, title: "Claim Approved", time: "Yesterday", description: "Finder authorized handover.", completed: true, current: true },
        ],
        handover: {
          isEligible: true,
          status: "ready",
          handoverCode: "FP-4198",
          locationName: "Uttara Sector 7 Police Booth",
          timeSlot: "Friday, 11:00 AM",
        },
      },
      {
        claimNumber: "CLM-824109",
        reportId: insertedFound[9]._id, // Winter Cardigan
        itemTitle: insertedFound[9].title,
        itemThumbnail: insertedFound[9].images[0],
        category: "Clothing & Accessories",
        location: insertedFound[9].location,
        status: "pending",
        statusLabel: "Under Review",
        statusDescription: "Finder is reviewing brand label details.",
        claimant: {
          userId: "usr_demo_08",
          name: "Nusrat Jahan",
          email: "demo.nusrat@findora.app",
          avatar: DEMO_USERS[7].image,
        },
        finder: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          avatar: DEMO_USERS[3].image,
        },
        claimantProof: {
          description: "Zara knit size L with small silver safety pin on inner tag.",
          submittedAt: new Date(Date.now() - 3600000 * 18),
        },
        timeline: [
          { step: 1, title: "Claim Submitted", time: "18 hours ago", description: "Tag detail noted.", completed: true, current: true },
        ],
      },
      {
        claimNumber: "CLM-824110",
        reportId: insertedFound[10]._id, // Camera Bag
        itemTitle: insertedFound[10].title,
        itemThumbnail: insertedFound[10].images[0],
        category: "Bags & Luggage",
        location: insertedFound[10].location,
        status: "approved",
        statusLabel: "Reunited & Closed",
        statusDescription: "Handover successfully completed at Shahbagh Metro Station.",
        claimant: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          avatar: DEMO_USERS[0].image,
        },
        finder: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          avatar: DEMO_USERS[5].image,
        },
        claimantProof: {
          description: "Three SanDisk 64GB cards containing RAW files of Dhaka street photography.",
          submittedAt: new Date(Date.now() - 86400000 * 4),
        },
        reviewNotes: "Photos on cards confirmed Alex as photographer.",
        timeline: [
          { step: 1, title: "Claim Submitted", time: "4 days ago", description: "Proof verified.", completed: true },
          { step: 2, title: "Claim Approved", time: "3 days ago", description: "Reunited safely.", completed: true, current: true },
        ],
      },
      {
        claimNumber: "CLM-824111",
        reportId: insertedFound[11]._id, // Canadian PR Card
        itemTitle: insertedFound[11].title,
        itemThumbnail: insertedFound[11].images[0],
        category: "Documents & Wallets",
        location: insertedFound[11].location,
        status: "approved",
        statusLabel: "Approved - Safe Handover Active",
        statusDescription: "Holder passport copy matches card name and document number.",
        claimant: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          avatar: DEMO_USERS[4].image,
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
        },
        claimantProof: {
          description: "PR card number matches my passport and immigration confirmation letters.",
          submittedAt: new Date(Date.now() - 86400000 * 2),
        },
        reviewNotes: "Identity confirmed via official government portal comparison.",
        timeline: [
          { step: 1, title: "Claim Submitted", time: "2 days ago", description: "ID match submitted.", completed: true },
          { step: 2, title: "Claim Approved", time: "Yesterday", description: "Verification successful.", completed: true, current: true },
        ],
        handover: {
          isEligible: true,
          status: "ready",
          handoverCode: "FP-1823",
          locationName: "Agargaon Passport Office Security Gate 1",
          timeSlot: "Sunday, 10:00 AM",
        },
      },
    ];

    const insertedClaims = await Claim.insertMany(claimDocs);
    console.log(`✅ ${insertedClaims.length} Claims seeded.`);

    // 6. Seed 10 Handovers
    console.log("Seeding 10 Handovers...");
    const handoverDocs = [
      {
        claimId: insertedClaims[0]._id,
        reportId: insertedFound[0]._id,
        itemTitle: insertedFound[0].title,
        itemCategory: "Documents & Wallets",
        itemThumbnail: insertedFound[0].images[0],
        owner: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          avatar: DEMO_USERS[0].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        timeSlot: "Afternoon (04:30 PM - 05:30 PM)",
        location: "Dhanmondi Police Station, Main Reception Lobby",
        safetyNote: "Meet inside the police station lobby near the inquiry counter under CCTV.",
        status: "proposed",
        confirmations: { ownerConfirmed: false, finderConfirmed: true },
        history: [{ at: new Date(), by: "Tariqul Islam", action: "Proposed handover at Dhanmondi Police Station" }],
      },
      {
        claimId: insertedClaims[3]._id,
        reportId: insertedFound[7]._id,
        itemTitle: insertedFound[7].title,
        itemCategory: "Jewelry & Watches",
        itemThumbnail: insertedFound[7].images[0],
        owner: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          avatar: DEMO_USERS[4].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_08",
          name: "Nusrat Jahan",
          email: "demo.nusrat@findora.app",
          avatar: DEMO_USERS[7].image,
          role: "finder",
        },
        proposedBy: "owner",
        meetingDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        timeSlot: "Lunch Hour (01:00 PM - 02:00 PM)",
        location: "Bashundhara City Mall, Customer Information Desk (Level 1)",
        safetyNote: "Public information desk area in daylight with staff presence.",
        status: "confirmed",
        confirmations: { ownerConfirmed: true, finderConfirmed: true },
        history: [
          { at: new Date(Date.now() - 86400000), by: "Farhana Yasmin", action: "Proposed meeting spot" },
          { at: new Date(Date.now() - 3600000 * 12), by: "Nusrat Jahan", action: "Accepted meeting proposal" },
        ],
      },
      {
        claimId: insertedClaims[2]._id,
        reportId: insertedFound[2]._id,
        itemTitle: insertedFound[2].title,
        itemCategory: "Electronics",
        itemThumbnail: insertedFound[2].images[0],
        owner: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          avatar: DEMO_USERS[0].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() - 86400000).toISOString().split("T")[0],
        timeSlot: "Morning (10:30 AM - 11:30 AM)",
        location: "Metro Rail Station Agargaon, Exit A Concourse",
        safetyNote: "Inside ticket gate area under CCTV coverage.",
        status: "completed",
        confirmations: { ownerConfirmed: true, finderConfirmed: true },
        ratingsUnlocked: true,
        completedAt: new Date(Date.now() - 86400000),
        history: [
          { at: new Date(Date.now() - 86400000 * 2), by: "Tariqul Islam", action: "Proposed meeting" },
          { at: new Date(Date.now() - 86400000), by: "Both Parties", action: "Two-party confirmed & reunited" },
        ],
      },
      {
        itemTitle: "Gold Chain with Diamond Pendant",
        itemCategory: "Jewelry & Watches",
        itemThumbnail: "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=800&q=80",
        owner: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          avatar: DEMO_USERS[4].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_09", // Flagged suspicious user!
          name: "Tanvir Hasan (Suspicious)",
          email: "demo.suspicious@findora.app",
          avatar: DEMO_USERS[8].image,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
        timeSlot: "Late Night (11:45 PM - 12:30 AM)",
        location: "Behind Old Bus Depot, Isolated Dark Alley Way",
        safetyNote: "Come alone without phone or police.",
        status: "proposed",
        confirmations: { ownerConfirmed: false, finderConfirmed: true },
        suspiciousFlags: [
          "Non-public or isolated venue detected",
          "Late night meeting (11:45 PM)",
          "High-value jewelry risk trigger",
        ],
        adminWarnings: [
          {
            id: `wrn_${Date.now()}`,
            target: "both",
            title: "Hazardous Meeting Detected: Do Not Attend",
            message: "Our Trust & Safety AI detected an isolated venue at midnight. Reschedule immediately to a local police station in daylight.",
            severity: "critical",
            sentAt: new Date(),
          },
        ],
        history: [
          { at: new Date(), by: "Tanvir Hasan", action: "Proposed suspicious late night exchange" },
          { at: new Date(), by: "Findora Trust Admin", action: "Issued CRITICAL safety warning" },
        ],
      },
      {
        claimId: insertedClaims[5]._id,
        reportId: insertedFound[5]._id,
        itemTitle: insertedFound[5].title,
        itemCategory: "Clothing & Accessories",
        itemThumbnail: insertedFound[5].images[0],
        owner: {
          userId: "usr_demo_07",
          name: "Kamrul Hasan",
          email: "demo.kamrul@findora.app",
          avatar: DEMO_USERS[6].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          avatar: DEMO_USERS[5].image,
          role: "finder",
        },
        proposedBy: "owner",
        meetingDate: new Date(Date.now() + 86400000).toISOString().split("T")[0],
        timeSlot: "Lunch Hour (01:30 PM - 02:30 PM)",
        location: "Star Kabab & Restaurant (Dhanmondi 2), Family Dining Floor",
        safetyNote: "Public daytime restaurant dining room.",
        status: "confirmed",
        confirmations: { ownerConfirmed: true, finderConfirmed: true },
        history: [
          { at: new Date(Date.now() - 3600000 * 20), by: "Kamrul Hasan", action: "Suggested lunch hour handover" },
          { at: new Date(Date.now() - 3600000 * 10), by: "Nafis Fuad", action: "Confirmed venue and time" },
        ],
      },
      {
        claimId: insertedClaims[7]._id,
        reportId: insertedFound[8]._id,
        itemTitle: insertedFound[8].title,
        itemCategory: "Electronics",
        itemThumbnail: insertedFound[8].images[0],
        owner: {
          userId: "usr_demo_03",
          name: "Sarah Jenkins",
          email: "demo.sarah@findora.app",
          avatar: DEMO_USERS[2].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() + 86400000 * 4).toISOString().split("T")[0],
        timeSlot: "Morning (11:00 AM - 12:00 PM)",
        location: "Uttara Sector 7 Police Outreach Booth",
        safetyNote: "Designated community police booth with 24/7 security duty.",
        status: "proposed",
        confirmations: { ownerConfirmed: false, finderConfirmed: true },
        history: [{ at: new Date(), by: "Tariqul Islam", action: "Proposed safe meeting at Uttara Police booth" }],
      },
      {
        claimId: insertedClaims[9]._id,
        reportId: insertedFound[10]._id,
        itemTitle: insertedFound[10].title,
        itemCategory: "Bags & Luggage",
        itemThumbnail: insertedFound[10].images[0],
        owner: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          avatar: DEMO_USERS[0].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_06",
          name: "Nafis Fuad",
          email: "demo.nafis@findora.app",
          avatar: DEMO_USERS[5].image,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
        timeSlot: "Evening (05:00 PM - 06:00 PM)",
        location: "Shahbagh Metro Station, Platform 2 Waiting Area",
        safetyNote: "Transit concourse under active transit police surveillance.",
        status: "completed",
        confirmations: { ownerConfirmed: true, finderConfirmed: true },
        ratingsUnlocked: true,
        completedAt: new Date(Date.now() - 86400000 * 2),
        history: [
          { at: new Date(Date.now() - 86400000 * 3), by: "Nafis Fuad", action: "Scheduled meeting at Shahbagh" },
          { at: new Date(Date.now() - 86400000 * 2), by: "Both Parties", action: "Item successfully reunited" },
        ],
      },
      {
        claimId: insertedClaims[10]._id,
        reportId: insertedFound[11]._id,
        itemTitle: insertedFound[11].title,
        itemCategory: "Documents & Wallets",
        itemThumbnail: insertedFound[11].images[0],
        owner: {
          userId: "usr_demo_05",
          name: "Farhana Yasmin",
          email: "demo.farhana@findora.app",
          avatar: DEMO_USERS[4].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
          role: "finder",
        },
        proposedBy: "owner",
        meetingDate: new Date(Date.now() + 86400000 * 2).toISOString().split("T")[0],
        timeSlot: "Morning (10:00 AM - 11:00 AM)",
        location: "Agargaon Passport Office Security Gate 1",
        safetyNote: "Official government entrance gate with security personnel present.",
        status: "confirmed",
        confirmations: { ownerConfirmed: true, finderConfirmed: true },
        history: [
          { at: new Date(Date.now() - 3600000 * 15), by: "Farhana Yasmin", action: "Proposed Agargaon security gate" },
          { at: new Date(Date.now() - 3600000 * 5), by: "Tariqul Islam", action: "Agreed to meet at Gate 1" },
        ],
      },
      {
        reportId: insertedLost[0]._id,
        itemTitle: insertedLost[0].title,
        itemCategory: "Electronics",
        itemThumbnail: insertedLost[0].images[0],
        owner: {
          userId: "usr_demo_01",
          name: "Alex Rivera",
          email: "demo.alex@findora.app",
          avatar: DEMO_USERS[0].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_04",
          name: "Rahim Chowdhury",
          email: "demo.rahim@findora.app",
          avatar: DEMO_USERS[3].image,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() + 86400000 * 3).toISOString().split("T")[0],
        timeSlot: "Afternoon (03:00 PM - 04:00 PM)",
        location: "Police Plaza Concord Shopping Mall, Central Lobby",
        safetyNote: "Well-lit ground floor concourse in Gulshan 1.",
        status: "proposed",
        confirmations: { ownerConfirmed: false, finderConfirmed: true },
        history: [{ at: new Date(), by: "Rahim Chowdhury", action: "Proposed meeting at Police Plaza" }],
      },
      {
        reportId: insertedLost[2]._id,
        itemTitle: insertedLost[2].title,
        itemCategory: "Bags & Luggage",
        itemThumbnail: insertedLost[2].images[0],
        owner: {
          userId: "usr_demo_03",
          name: "Sarah Jenkins",
          email: "demo.sarah@findora.app",
          avatar: DEMO_USERS[2].image,
          role: "owner",
        },
        finder: {
          userId: "usr_demo_02",
          name: "Tariqul Islam",
          email: "demo.tariq@findora.app",
          phone: "+880 1819-234567",
          avatar: DEMO_USERS[1].image,
          role: "finder",
        },
        proposedBy: "finder",
        meetingDate: new Date(Date.now() - 86400000 * 3).toISOString().split("T")[0],
        timeSlot: "Noon (12:00 PM - 01:00 PM)",
        location: "Banani Club Reception Counter, Banani, Dhaka",
        safetyNote: "Private member club reception with concierge staff.",
        status: "completed",
        confirmations: { ownerConfirmed: true, finderConfirmed: true },
        ratingsUnlocked: true,
        completedAt: new Date(Date.now() - 86400000 * 3),
        history: [
          { at: new Date(Date.now() - 86400000 * 4), by: "Tariqul Islam", action: "Arranged handover at Banani Club" },
          { at: new Date(Date.now() - 86400000 * 3), by: "Both Parties", action: "Successfully returned bag to owner" },
        ],
      },
    ];

    const insertedHandovers = await Handover.insertMany(handoverDocs);
    console.log(`✅ ${insertedHandovers.length} Handovers seeded.`);

    console.log("\n========================================================");
    console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
    console.log("========================================================");
    console.log("10 Demo Users seeded with password: 'DemoPass123!'");
    console.log("Lost Items seeded:", insertedLost.length);
    console.log("Found Items seeded:", insertedFound.length);
    console.log("Claims seeded:", insertedClaims.length);
    console.log("Handovers seeded:", insertedHandovers.length);
    console.log("========================================================\n");

    process.exit(0);
  } catch (err) {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  }
}

// Execute seeder
runSeeder();
