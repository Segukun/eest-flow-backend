import * as categoryService from "../services/category.service.js";

export const createCategory = async (req, res, next) => {
  try {
    const { name, color, sectors } = req.body;

    const category = await categoryService.createCategory({
      name,
      color,
      sectors,
    });

    return res.status(201).json(category);
  } catch (error) {
    return next(error);
  }
};

export async function getCategories(req, res, next) {
  try {
    const data = await categoryService.getCategories();
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
}

export async function getCategoryById(req, res, next) {
  try {
    const { id } = req.params;
    const category = await categoryService.getCategoryById(id);
    return res.status(200).json(category);
  } catch (error) {
    return next(error);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const { id } = req.params;
    const { name, color, sectors } = req.body;
    const updatedCategory = await categoryService.updateCategory(id, {
      name,
      color,
      sectors,
    });
    return res.status(200).json(updatedCategory);
  } catch (error) {
    return next(error);
  }
}

export async function softDeleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    await categoryService.disableCategory(id);
    return res.status(200).json({ message: "Category soft deleted" });
  } catch (error) {
    return next(error);
  }
}