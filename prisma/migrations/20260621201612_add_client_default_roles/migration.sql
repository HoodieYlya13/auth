-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "defaultRoles" TEXT[] DEFAULT ARRAY['USER']::TEXT[];
