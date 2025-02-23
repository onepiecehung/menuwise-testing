import {
  GetProductsForIngredient,
  GetRecipes,
} from "./supporting-files/data-access";
import {
  ConvertUnits,
  GetCostPerBaseUnit,
  GetNutrientFactInBaseUnits,
} from "./supporting-files/helpers";
import {
  NutrientFact,
  Recipe,
  UnitOfMeasure,
  UoMName,
  UoMType,
} from "./supporting-files/models";
import { ExpectedRecipeSummary, RunTest } from "./supporting-files/testing";

console.clear();
console.log("Expected Result Is:", ExpectedRecipeSummary);

const recipeData = GetRecipes(); // the list of 1 recipe you should calculate the information for
console.log("Recipe Data:", recipeData);
const recipeSummary: { [key: string]: any } = {}; // the final result to pass into the test function
/*
 * YOUR CODE GOES BELOW THIS, DO NOT MODIFY ABOVE
 * (You can add more imports if needed)
 * */
/**
 * A multi-step unit conversion function.
 * - If direct conversion fails, it handles specific cases like:
 *   - Volume → Mass: Converts via millilitres as an intermediate step.
 *   - Whole → Mass: Converts directly to grams using a predefined factor.
 */
function ConvertUnitsMultiStep(
  fromUoM: UnitOfMeasure,
  toUoMName: UoMName,
  toUoMType: UoMType
): UnitOfMeasure {
  // If the source and target units are the same, return immediately
  if (fromUoM.uomName === toUoMName && fromUoM.uomType === toUoMType) {
    return fromUoM;
  }

  try {
    // Attempt direct conversion
    return ConvertUnits(fromUoM, toUoMName, toUoMType);
  } catch (error) {
    // Handle volume → mass conversion via millilitres
    if (fromUoM.uomType === UoMType.volume && toUoMType === UoMType.mass) {
      // Convert volume to millilitres first
      const ml = ConvertUnits(fromUoM, UoMName.millilitres, UoMType.volume);
      // Then convert millilitres to grams
      return ConvertUnits(ml, UoMName.grams, UoMType.mass);
    }

    // Handle whole → mass conversion (e.g., eggs → grams)
    if (fromUoM.uomType === UoMType.whole && toUoMType === UoMType.mass) {
      // Convert whole units directly to grams
      return ConvertUnits(fromUoM, UoMName.grams, UoMType.mass);
    }

    // If no specific case matches, rethrow the error
    throw error;
  }
}

/**
 * Calculates the cheapest cost and nutritional summary for a given recipe.
 * @param recipe - The recipe to calculate.
 * @returns An object containing the cheapest cost and nutritional summary.
 */
function calculateCheapestRecipe(recipe: Recipe) {
  let totalCost = 0; // Total cost of the recipe
  const nutrientSummary: Record<string, NutrientFact> = {}; // Nutritional summary

  // Iterate through each ingredient in the recipe
  for (const lineItem of recipe.lineItems) {
    // Get all available products for the current ingredient
    const products = GetProductsForIngredient(lineItem.ingredient);
    if (products.length === 0) {
      throw new Error(
        `No products found for ingredient: ${lineItem.ingredient.ingredientName}`
      );
    }

    // Find the cheapest supplier based on the cost per base unit
    const cheapestSupplier = products
      .flatMap((p) => p.supplierProducts) // Flatten the array of supplier products
      .reduce((min, sp) => {
        const minCost = GetCostPerBaseUnit(min); // Get the cost per base unit for the current minimum
        const currentCost = GetCostPerBaseUnit(sp); // Get the cost per base unit for the current supplier
        return currentCost < minCost ? sp : min; // Return the supplier with the lower cost
      });

    // Convert the required amount to the supplier's unit of measure
    const requiredAmount = ConvertUnitsMultiStep(
      lineItem.unitOfMeasure, // The unit of measure from the recipe
      cheapestSupplier.supplierProductUoM.uomName, // The target unit name
      cheapestSupplier.supplierProductUoM.uomType // The target unit type
    );

    // Calculate the cost using the price per base unit
    const pricePerBaseUnit = GetCostPerBaseUnit(cheapestSupplier); // Get the price per base unit
    const cost = pricePerBaseUnit * requiredAmount.uomAmount; // Calculate the total cost for the required amount
    totalCost += cost; // Add the cost to the total cost

    // Find the product associated with the cheapest supplier
    const product = products.find((p) =>
      p.supplierProducts.includes(cheapestSupplier)
    )!;

    // Aggregate nutritional information
    for (const nf of product.nutrientFacts) {
      // Standardize the nutrient fact to base units
      const std = GetNutrientFactInBaseUnits(nf);
      if (!nutrientSummary[std.nutrientName]) {
        // If the nutrient is not in the summary, add it
        nutrientSummary[std.nutrientName] = std;
      } else {
        // If the nutrient already exists, accumulate the amount
        nutrientSummary[std.nutrientName].quantityAmount.uomAmount +=
          std.quantityAmount.uomAmount;
      }
    }
  }

  // Sort the nutrient summary by nutrient name for consistency
  const sortedNutrientSummary = Object.keys(nutrientSummary)
    .sort()
    .reduce((acc, key) => {
      acc[key] = nutrientSummary[key];
      return acc;
    }, {} as Record<string, NutrientFact>);

  // Return the total cost and sorted nutritional summary
  return {
    cheapestCost: totalCost,
    nutrientsAtCheapestCost: sortedNutrientSummary,
  };
}

// Process all recipes and store the results in recipeSummary
recipeData.forEach((recipe) => {
  recipeSummary[recipe.recipeName] = calculateCheapestRecipe(recipe);
});

/*
 * YOUR CODE ABOVE THIS, DO NOT MODIFY BELOW
 * */
RunTest(recipeSummary);
