let fs=require('fs')
let path=require('path')
let ejs=require('ejs')
let babylon=require('babylon')
let t=require('@babel/types')
let traverse=require('@babel/traverse').default
let generator=require('@babel/generator').default
// babylon 主要把源码转换成ast
// @babel/traverse 遍历节点
// @babel/types 替换节点
// @babel/generator 生成

class Compiler{
    constructor(config){
        this.config=config;
        //需要保存入口文件的路径
        this.entryId;
        //需要保存所有的模块依赖
        this.modules={};
        this.entry=config.entry;
        // 工作路径
        this.root=process.cwd();
    }
    getSource(modulePath){
        let content=fs.readFileSync(modulePath,'utf8')
        return content
    }
    parse(source,parentPath){
        // 解析源码 AST解析语法树
        let ast=babylon.parse(source)
        let dependencies=[];
        traverse(ast,{
            CallExpression(p){
                let node=p.node//对应的节点
                if(node.callee.name==='require'){
                    node.callee.name='__webpack_require__'
                    let moduleName=node.arguments[0].value
                    moduleName=moduleName+(path.extname(moduleName)?'':'.js')
                    moduleName='./'+path.join(parentPath,moduleName)// ./src/a.js
                    dependencies.push(moduleName)
                    node.arguments=[t.stringLiteral(moduleName)]
                }
            }
        });
        let sourceCode=generator(ast).code
        return {sourceCode,dependencies}
    }
    buildModule(modulePath,isEntry){
        // 构建模块
        // 拿到模块的内容
        let source=this.getSource(modulePath)
        // 模块id 相对路径
        let moduleName='./'+path.relative(this.root,modulePath)// ./src\index.js

        if(isEntry){
            //保存入口的名字
            this.entryId=moduleName
        }
        //把source源码进行改造 返回一个依赖列表
        let{sourceCode,dependencies}=this.parse(source,path.dirname(moduleName))
        this.modules[moduleName]=sourceCode
        dependencies.forEach(dep=>{
            this.buildModule(path.join(this.root,dep),false)
        })
    }
    emitFile(){
        // 发射文件
        let main=path.join(this.config.output.path,this.config.output.filename)// 输出路径
        let templateStr=this.getSource(path.join(__dirname,'main.ejs'))// 模板路径
        let code=ejs.render(templateStr,{
            entryId:this.entryId,
            modules:this.modules
        })
        this.assets={}
        this.assets[main]=code
        fs.writeFileSync(main,this.assets[main])
    }
    run(){
        // 创建模块的依赖关系
        this.buildModule(path.resolve(this.root,this.entry),true);
        console.log(this.modules,this.entryId)
        // 发射一个文件 打包后的文件
        this.emitFile();
    }
}
module.exports=Compiler