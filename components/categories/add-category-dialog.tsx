"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCategoryStore } from "@/lib/store/category-store";
import { notify } from "@/lib/store/toast-store";

/** Ручное добавление категории в справочник файла. */
export function AddCategoryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addCategory = useCategoryStore((state) => state.addCategory);
  const [title, setTitle] = useState("");
  const [id, setId] = useState("");

  const reset = () => {
    setTitle("");
    setId("");
  };

  const handleSave = async () => {
    const ok = await addCategory(id, title);
    if (!ok) {
      notify("Вкажіть назву та ID категорії", "error");
      return;
    }
    notify("Категорію додано", "success");
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Нова категорія</DialogTitle>
          <DialogDescription>
            ID потрібен для адмінки — він не генерується автоматично.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="category-title">Назва</Label>
          <Input
            id="category-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Женские костюмы"
          />
          <Label htmlFor="category-id">goods_category_id</Label>
          <Input
            id="category-id"
            value={id}
            onChange={(event) => setId(event.target.value)}
            placeholder="4637671"
            inputMode="numeric"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button onClick={() => void handleSave()}>Додати</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
