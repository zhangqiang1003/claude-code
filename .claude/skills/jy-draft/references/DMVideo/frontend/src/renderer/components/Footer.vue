<template>
     <el-footer height="auto" class="app-footer">
        <div class="footer-content">
          FOOTER
        </div>
        <div class="footer-bottom">
          <p>Copyright © 2026 dmao. All rights reserved.</p>
        </div>
      </el-footer>
</template>

<script setup lang="ts">
import { openExternal } from "../utils/utils";
import ContactMe from "./ContactMe.vue";
</script>

<style scoped>  

.app-footer {
  background-color: #222831;
  color: #eeeeee;
  padding: 24px 0;
  margin-top: 20px;
  border-top: 1px solid rgba(0, 173, 181, 0.1);
}

.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 40px;
  padding: 0 20px;
}

.footer-section {
  padding: 0 20px;
}

.footer-section h4 {
  color: #6366f1;
  font-size: 16px;
  margin-bottom: 12px;
  font-weight: 600;
}

.footer-section p {
  font-size: 14px;
  line-height: 1.6;
  margin: 8px 0;
  color: rgba(238, 238, 238, 0.9);
}

.footer-bottom {
  text-align: center;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 173, 181, 0.1);
}

.footer-bottom p {
  font-size: 12px;
  color: rgba(238, 238, 238, 0.6);
}
</style>