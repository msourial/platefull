import { db } from "./index";
import * as schema from "@shared/schema";
import { eq } from "drizzle-orm";

async function seed() {
  try {
    console.log("Seeding database...");

    // Seed categories
    const existingCategories = await db.query.categories.findMany();
    const categoryData = [
      { name: "Burgers", description: "Delicious burgers with premium ingredients", icon: "lunch_dining", displayOrder: 1 },
      { name: "Pizza", description: "Handcrafted pizzas with fresh toppings", icon: "local_pizza", displayOrder: 2 },
      { name: "Pasta", description: "Authentic Italian pasta dishes", icon: "ramen_dining", displayOrder: 3 },
      { name: "Drinks", description: "Refreshing beverages", icon: "local_bar", displayOrder: 4 },
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

    // Seed menu items
    const existingMenuItems = await db.query.menuItems.findMany();
    const menuItemsData = [
      {
        name: "Classic Burger",
        description: "Beef patty, lettuce, tomato, cheese, and our special sauce",
        price: "8.99",
        imageUrl: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Burgers"),
        isAvailable: true
      },
      {
        name: "Deluxe Burger",
        description: "Double beef patty, bacon, avocado, cheese, and premium toppings",
        price: "12.99",
        imageUrl: "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Burgers"),
        isAvailable: true
      },
      {
        name: "Veggie Burger",
        description: "Plant-based patty with fresh vegetables and vegan sauce",
        price: "10.99",
        imageUrl: "https://images.unsplash.com/photo-1520072959219-c595dc870360?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Burgers"),
        isAvailable: true
      },
      {
        name: "Margherita Pizza",
        description: "Classic pizza with tomato sauce, mozzarella, and basil",
        price: "11.99",
        imageUrl: "https://images.unsplash.com/photo-1595854341625-f33ee10dbf94?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Pizza"),
        isAvailable: true
      },
      {
        name: "Pepperoni Pizza",
        description: "Pizza with tomato sauce, mozzarella, and pepperoni",
        price: "13.99",
        imageUrl: "https://images.unsplash.com/photo-1628840042765-356cda07504e?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Pizza"),
        isAvailable: true
      },
      {
        name: "Spaghetti Bolognese",
        description: "Spaghetti with rich meat sauce and parmesan",
        price: "12.99",
        imageUrl: "https://images.unsplash.com/photo-1622973536968-3ead9e780960?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Pasta"),
        isAvailable: true
      },
      {
        name: "Fettuccine Alfredo",
        description: "Fettuccine pasta with creamy alfredo sauce",
        price: "11.99",
        imageUrl: "https://images.unsplash.com/photo-1645112411341-6c4fd023882c?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Pasta"),
        isAvailable: true
      },
      {
        name: "Coca-Cola",
        description: "16 oz can",
        price: "2.99",
        imageUrl: "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Drinks"),
        isAvailable: true
      },
      {
        name: "Diet Coke",
        description: "16 oz can",
        price: "2.99",
        imageUrl: "https://images.unsplash.com/photo-1629203432180-71e9b18d315e?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Drinks"),
        isAvailable: true
      },
      {
        name: "Bottled Water",
        description: "500ml bottle",
        price: "1.99",
        imageUrl: "https://images.unsplash.com/photo-1616118132534-381148898bb4?ixlib=rb-1.2.1&auto=format&fit=crop&w=500&h=500&q=80",
        categoryId: categoriesMap.get("Drinks"),
        isAvailable: true
      },
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
        menuItemId: menuItemsNameMap.get("Classic Burger"),
        name: "Patty Preparation",
        choices: ["Medium Rare", "Medium", "Medium Well", "Well Done"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Classic Burger"),
        name: "Toppings",
        choices: ["Lettuce", "Tomato", "Pickles", "Onions"],
        isRequired: false
      },
      {
        menuItemId: menuItemsNameMap.get("Deluxe Burger"),
        name: "Patty Preparation",
        choices: ["Medium Rare", "Medium", "Medium Well", "Well Done"],
        isRequired: true
      },
      {
        menuItemId: menuItemsNameMap.get("Deluxe Burger"),
        name: "Toppings",
        choices: ["Lettuce", "Tomato", "Pickles", "Onions", "Avocado", "Bacon"],
        isRequired: false
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
