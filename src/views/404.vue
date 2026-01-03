<template>
  <div class="container">
    <div class="main">
      <div class="bullshit">
        <div class="bullshit__headline">The webmaster said that you can not enter this page...</div>
      </div>
    </div>
  </div>
</template>

<script>

export default {
  name: '404',
}
</script>

<style lang="scss" scoped>
.container{
  transform: translate(-50%,-50%);
  position: absolute;
  top: 40%;
  left: 50%;
}
.main {
  position: relative;
  width: auto;
  padding: 0 50px;
  overflow: hidden;
  .bullshit {
    position: relative;
    float: none;
    width: auto;
    padding: 30px 0;
    overflow: hidden;
    &__headline {
      font-size: 20px;
      line-height: 24px;
      color: #222;
      font-weight: bold;
      opacity: 0;
      margin-bottom: 10px;
      animation-name: slideUp;
      animation-duration: 0.5s;
      animation-delay: 0.1s;
      animation-fill-mode: forwards;
    }
    @keyframes slideUp {
      0% {
        transform: translateY(60px);
        opacity: 0;
      }
      100% {
        transform: translateY(0);
        opacity: 1;
      }
    }
  }
}
</style>
