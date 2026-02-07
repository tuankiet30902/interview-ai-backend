module.exports =[
    {path:"/management/user",router:require('./user/user.router')},
    {path:"/management/setup",router:require('./services/setup.router')},
    {path:"/management/system",router:require('./services/system.router')},
    {path:"/management/localization",router:require('./localization/localization.router')},
    {path:"/management/rule",router:require('./rule/rule.router')},
    { path: "/management/setting", router: require('../management/setting/router') },
    { path: "/management/ringbell_item", router: require('../management/ringbell_item/router') }
];
