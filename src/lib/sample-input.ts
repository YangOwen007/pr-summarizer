// A realistic sample helps recruiters and local testers understand the product immediately.
export const sampleDiff = `diff --git a/src/lib/auth.ts b/src/lib/auth.ts
index b221cb0..6bce7b2 100644
--- a/src/lib/auth.ts
+++ b/src/lib/auth.ts
@@ -14,15 +14,17 @@ export async function verifySession(token: string | null) {
   if (!token) {
     return null;
   }
 
-  const session = await db.session.findUnique({
-    where: { token },
+  const session = await db.session.findFirst({
+    where: {
+      token,
+      revokedAt: null,
+    },
   });
 
   if (!session) {
     return null;
   }
 
-  if (session.expiresAt < new Date()) {
-    return null;
-  }
+  if (session.expiresAt < new Date()) return null;
 
   return db.user.findUnique({
     where: { id: session.userId },
@@ -38,7 +40,12 @@ export async function login(email: string, password: string) {
   const user = await db.user.findUnique({ where: { email } });
 
   if (!user) {
-    throw new Error("Invalid credentials");
+    return {
+      ok: false,
+      reason: "invalid_credentials",
+    };
   }
 
   const passwordMatches = await compare(password, user.passwordHash);
@@ -48,6 +55,10 @@ export async function login(email: string, password: string) {
     throw new Error("Invalid credentials");
   }
 
+  await db.session.deleteMany({
+    where: { userId: user.id },
+  });
+
   const session = await db.session.create({
     data: {
       userId: user.id,`;
