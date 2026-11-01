BEGIN;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "photoId" UUID;

-- CreateTable
CREATE TABLE "ProductPhoto" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "contentType" VARCHAR(32) NOT NULL DEFAULT 'image/webp',
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductPhoto_key_key" ON "ProductPhoto"("key");

-- CreateIndex
CREATE INDEX "ProductPhoto_createdById_createdAt_idx" ON "ProductPhoto"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "Product_photoId_idx" ON "Product"("photoId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "ProductPhoto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPhoto" ADD CONSTRAINT "ProductPhoto_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProductPhoto" ADD CONSTRAINT "ProductPhoto_valid_asset" CHECK (
  "contentType"='image/webp' AND "byteSize" BETWEEN 1 AND 2000000 AND
  width > 0 AND height > 0 AND width::bigint*height::bigint <= 20000000 AND
  sha256 ~ '^[a-f0-9]{64}$' AND "key" = id::text || '.webp'
);

COMMIT;
