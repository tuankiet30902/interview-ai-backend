const { TENANT_DOMAIN } = process.env;

function generateDbnamePrefix(domain) {
    let cleanDomain = domain.replace(/^https?:\/\//, '');
    
    cleanDomain = cleanDomain.replace(/[:\/\.]/g, '_');
    
    return cleanDomain;
}

const domain = TENANT_DOMAIN;
const dbname_prefix = generateDbnamePrefix(domain);

module.exports = {
    "domain": domain,
    "dbname_prefix": dbname_prefix,
}
