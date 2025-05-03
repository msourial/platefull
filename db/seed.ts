import { db } from "./index";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  try {
    console.log("Seeding database...");

    // Seed categories - Boustan Menu Categories
    const existingCategories = await db.query.categories.findMany();
    const categoryData = [
      { name: "Pitas & Wraps", description: "Delicious pitas and wraps with fresh ingredients", icon: "flatware", displayOrder: 1 },
      { name: "Platters", description: "Complete meal platters with sides", icon: "restaurant", displayOrder: 2 },
      { name: "Salads", description: "Fresh salads with a variety of toppings", icon: "eco", displayOrder: 3 },
      { name: "Sides", description: "Delicious sides to complement your meal", icon: "dinner_dining", displayOrder: 4 },
      { name: "Sweets", description: "Sweet treats and desserts", icon: "icecream", displayOrder: 5 },
      { name: "Beverages", description: "Refreshing drinks", icon: "local_bar", displayOrder: 6 },
    ];

    for (const category of categoryData) {
      // Check if category already exists
      const existingCategory = existingCategories.find(c => c.name === category.name);
      if (!existingCategory) {
        const [newCategory] = await db.insert(schema.categories).values(category).returning();
        console.log(`Added category: ${newCategory.name}`);
      } else {
        console.log(`Category ${category.name} already exists`);
      }
    }

    // Get all categories after insert
    const allCategories = await db.query.categories.findMany();
    const categoriesMap = new Map(allCategories.map(c => [c.name, c.id]));

    // Seed menu items - Boustan Menu Items
    const existingMenuItems = await db.query.menuItems.findMany();
    const menuItemsData = [
      // Pitas & Wraps
      {
        name: "Shish Taouk Pita",
        description: "Marinated chicken breast pieces, garlic sauce, lettuce, tomatoes, and pickles",
        price: "8.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/c35f77a1-a767-4dd2-b187-63b80a25d4f5-retina-large.jpg",
        categoryId: categoriesMap.get("Pitas & Wraps"),
        isAvailable: true
      },
      {
        name: "Beef Shawarma Pita",
        description: "Thin slices of marinated beef, garlic sauce, lettuce, tomatoes, and pickles",
        price: "9.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/11ca3d23-9294-49c3-95ce-bbd8a9dfc0d3-retina-large.jpg",
        categoryId: categoriesMap.get("Pitas & Wraps"),
        isAvailable: true
      },
      {
        name: "Chicken Shawarma Pita",
        description: "Thin slices of marinated chicken, garlic sauce, lettuce, tomatoes, and pickles",
        price: "9.49",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/f033a084-df30-412a-b384-48826ed174bc-retina-large.jpg",
        categoryId: categoriesMap.get("Pitas & Wraps"),
        isAvailable: true
      },
      {
        name: "Falafel Pita",
        description: "Deep-fried patties made from ground chickpeas, tahini sauce, lettuce, tomatoes, and pickles",
        price: "7.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/c6c4dec4-0bdd-4108-84d7-98ba9ce30253-retina-large.jpg",
        categoryId: categoriesMap.get("Pitas & Wraps"),
        isAvailable: true
      },
      {
        name: "Kafta Pita",
        description: "Grilled skewers of ground beef mixed with parsley, onions, and spices",
        price: "9.49",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/0689a56d-7aa7-4bf6-bf8c-21d4dcf9f4e6-retina-large.jpg",
        categoryId: categoriesMap.get("Pitas & Wraps"),
        isAvailable: true
      },
      {
        name: "Shish Taouk Wrap",
        description: "Marinated chicken breast pieces, garlic sauce, lettuce, tomatoes, and pickles wrapped in a thin lavash bread",
        price: "11.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/5a3dc2a3-94ac-4f22-934a-ecfe5414583e-retina-large.jpg",
        categoryId: categoriesMap.get("Pitas & Wraps"),
        isAvailable: true
      },
      
      // Platters
      {
        name: "Shish Taouk Platter",
        description: "Marinated chicken breast pieces served with garlic sauce, hummus, salad, and rice or fries",
        price: "17.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/34f2d87e-1b71-42ec-aabc-5bef98dafcf7-retina-large.jpg",
        categoryId: categoriesMap.get("Platters"),
        isAvailable: true
      },
      {
        name: "Beef Shawarma Platter",
        description: "Thin slices of marinated beef served with garlic sauce, hummus, salad, and rice or fries",
        price: "18.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/26a9e5a4-8b1b-4c01-934b-39a49de93c38-retina-large.jpg",
        categoryId: categoriesMap.get("Platters"),
        isAvailable: true
      },
      {
        name: "Chicken Shawarma Platter",
        description: "Thin slices of marinated chicken served with garlic sauce, hummus, salad, and rice or fries",
        price: "17.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/24bd04c3-3c2b-43d1-9517-6c36f07b4a87-retina-large.jpg",
        categoryId: categoriesMap.get("Platters"),
        isAvailable: true
      },
      {
        name: "Mixed Grill Platter",
        description: "Combination of shish taouk, kafta, and beef with garlic sauce, hummus, salad, and rice or fries",
        price: "22.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/6b9ca1eb-b47b-4c42-bd59-3a0d7b335ded-retina-large.jpg",
        categoryId: categoriesMap.get("Platters"),
        isAvailable: true
      },
      {
        name: "Vegetarian Platter",
        description: "Falafel, hummus, baba ghanouj, tabbouleh, fattoush, and pita bread",
        price: "15.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/8ca7da6e-5e4a-4ccd-9c3c-16c8a1a8f317-retina-large.jpg",
        categoryId: categoriesMap.get("Platters"),
        isAvailable: true
      },
      
      // Salads
      {
        name: "Fattoush",
        description: "Mixed greens, vegetables, and toasted pita with sumac dressing",
        price: "7.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/ec3b5d03-7f29-426e-93f5-2c147ffe5a72-retina-large.jpg",
        categoryId: categoriesMap.get("Salads"),
        isAvailable: true
      },
      {
        name: "Tabbouleh",
        description: "Finely chopped parsley, tomatoes, mint, onion, with bulgur and lemon dressing",
        price: "7.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/3e11e5a1-c6df-4d14-8ca3-e3e2c7192a44-retina-large.jpg",
        categoryId: categoriesMap.get("Salads"),
        isAvailable: true
      },
      {
        name: "Greek Salad",
        description: "Mixed greens, feta cheese, olives, tomatoes, cucumbers with olive oil dressing",
        price: "8.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/c1b14867-73e0-404a-a638-2668ef3ee476-retina-large.jpg",
        categoryId: categoriesMap.get("Salads"),
        isAvailable: true
      },
      
      // Sides
      {
        name: "Hummus",
        description: "Chickpea dip with tahini, lemon juice, and olive oil",
        price: "5.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/1f87a63a-5b02-4f7d-9807-80d841edce79-retina-large.jpg",
        categoryId: categoriesMap.get("Sides"),
        isAvailable: true
      },
      {
        name: "Baba Ghanouj",
        description: "Roasted eggplant dip with tahini, lemon juice, and olive oil",
        price: "6.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/bbb03957-8141-42d9-8819-485dd2e0fa0a-retina-large.jpg",
        categoryId: categoriesMap.get("Sides"),
        isAvailable: true
      },
      {
        name: "Garlic Potatoes",
        description: "Crispy potato cubes with garlic and herbs",
        price: "5.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/0bea0ae2-9f31-4fec-84df-9a5e1ee7bd84-retina-large.jpg",
        categoryId: categoriesMap.get("Sides"),
        isAvailable: true
      },
      {
        name: "Fries",
        description: "Crispy golden french fries",
        price: "4.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/8cdb6182-9f1e-4a9c-9abe-ec52eef46311-retina-large.jpg",
        categoryId: categoriesMap.get("Sides"),
        isAvailable: true
      },
      
      // Sweets
      {
        name: "Baklava",
        description: "Layered pastry with nuts and honey syrup",
        price: "3.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/cc9b4eb6-64c9-446d-a08b-5f7c65de5934-retina-large.jpg",
        categoryId: categoriesMap.get("Sweets"),
        isAvailable: true
      },
      {
        name: "Knafeh",
        description: "Sweet cheese pastry with syrup",
        price: "5.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/1b2e7c33-0bca-43d4-9f11-f7bfec55e344-retina-large.jpg",
        categoryId: categoriesMap.get("Sweets"),
        isAvailable: true
      },
      
      // Beverages
      {
        name: "Ayran",
        description: "Traditional yogurt drink",
        price: "3.49",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/39b9f91a-6d7c-48c7-a7df-c50be22bd2be-retina-large.jpg",
        categoryId: categoriesMap.get("Beverages"),
        isAvailable: true
      },
      {
        name: "Minted Iced Tea",
        description: "Refreshing iced tea with fresh mint",
        price: "3.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/d4b24bc4-6190-48ac-a7d9-9e8fab0aca9c-retina-large.jpg",
        categoryId: categoriesMap.get("Beverages"),
        isAvailable: true
      },
      {
        name: "Soft Drinks",
        description: "Assorted carbonated beverages",
        price: "2.49",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/cbaa29fd-c6aa-41a2-8639-1ba96af25e33-retina-large.jpg",
        categoryId: categoriesMap.get("Beverages"),
        isAvailable: true
      },
      {
        name: "Bottled Water",
        description: "500ml bottle of mineral water",
        price: "1.99",
        imageUrl: "https://img.cdn4dd.com/p/fit=cover,width=600,format=auto,quality=50/media/photos/c3d95c6f-8dd4-4c99-9a90-3026add29c3a-retina-large.jpg",
        categoryId: categoriesMap.get("Beverages"),
        isAvailable: true
      }
    ];

    for (const menuItem of menuItemsData) {
      // Check if menu item already exists
      const existingMenuItem = existingMenuItems.find(m => m.name === menuItem.name);
      if (!existingMenuItem) {
        const [newMenuItem] = await db.insert(schema.menuItems).values(menuItem).returning();
        console.log(`Added menu item: ${newMenuItem.name}`);
      } else {
        console.log(`Menu item ${menuItem.name} already exists`);
      }
    }

    // Seed customization options
    const allMenuItems = await db.query.menuItems.findMany();
    const menuItemsNameMap = new Map(allMenuItems.map(m => [m.name, m.id]));

    const existingCustomizations = await db.query.customizationOptions.findMany();

    const customizationOptionsData = [
      {
        menuItemId: menuItemsNameMap.get("Shish Taouk Pita"),
        name: "Sauce Options",
        choices: ["Garlic Sauce", "Tahini Sauce", "Hot Sauce", "No Sauce"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Shish Taouk Pita"),
        name: "Extra Toppings",
        choices: ["Extra Pickles", "Extra Tomatoes", "Extra Lettuce", "Turnips"],
        isRequired: false
      },
      {
        menuItemId: menuItemsNameMap.get("Beef Shawarma Pita"),
        name: "Sauce Options",
        choices: ["Garlic Sauce", "Tahini Sauce", "Hot Sauce", "No Sauce"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Beef Shawarma Pita"),
        name: "Extra Toppings",
        choices: ["Extra Pickles", "Extra Tomatoes", "Extra Lettuce", "Turnips"],
        isRequired: false
      },
      {
        menuItemId: menuItemsNameMap.get("Chicken Shawarma Pita"),
        name: "Sauce Options",
        choices: ["Garlic Sauce", "Tahini Sauce", "Hot Sauce", "No Sauce"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Falafel Pita"),
        name: "Sauce Options",
        choices: ["Tahini Sauce", "Hot Sauce", "No Sauce"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Mixed Grill Platter"),
        name: "Side Options",
        choices: ["Rice", "Fries", "Half Rice & Half Fries"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Shish Taouk Platter"),
        name: "Side Options",
        choices: ["Rice", "Fries", "Half Rice & Half Fries"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Beef Shawarma Platter"),
        name: "Side Options",
        choices: ["Rice", "Fries", "Half Rice & Half Fries"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Chicken Shawarma Platter"),
        name: "Side Options",
        choices: ["Rice", "Fries", "Half Rice & Half Fries"],
        isRequired: true
      }
    ];

    for (const customization of customizationOptionsData) {
      // Check if customization already exists for the menu item
      const existingCustomization = existingCustomizations.find(
        c => c.menuItemId === customization.menuItemId && c.name === customization.name
      );
      if (!existingCustomization) {
        const [newCustomization] = await db.insert(schema.customizationOptions).values(customization).returning();
        console.log(`Added customization option: ${newCustomization.name} for menu item ID ${newCustomization.menuItemId}`);
      } else {
        console.log(`Customization ${customization.name} for menu item ID ${customization.menuItemId} already exists`);
      }
    }

    console.log("Database seeding completed successfully");
  } catch (error) {
    console.error("Error seeding database:", error);
  }
}

seed();
