const axios = require('axios')
const yaml = require('js-yaml')
const fs = require('fs')
const path = require('path')
const config = require('../../lib/config')
class ArgoApi {
    constructor(params) {
        this.disabled = true
        this.namespace = 'default'

        this.axios = axios.create({
            baseURL: params.baseUrl || 'http://localhost:2746/api/v1',
            timeout: 30 * 1000,
            headers: { 'content-type': 'application/json' },
        })
    }

    async submit(yamlFilename, entryPoint, parameters) {
        const yamlPath = path.join(
            __dirname,
            '..',
            'workflows',
            'argo',
            yamlFilename
        )
        let doc
        try {
            doc = yaml.safeLoad(fs.readFileSync(yamlPath, 'utf8'))
        } catch (e) {
            console.log(e)
            return
        }

        const params = Object.keys(parameters).map(key => {
            return { name: key, value: parameters[key] }
        })

        doc['spec']['entrypoint'] = entryPoint
        doc['spec']['arguments'] = { parameters: params }

        const body = {
            namespace: 'default',
            workflow: doc,
        }
        //console.log("body:", JSON.stringify(body, null, 4));

        if (this.disabled)
            // optional dry run for debug
            return

        console.log(
            `Submitting workflow ${yamlFilename}:${entryPoint}:`,
            parameters
        )
        try {
            const res = await this.axios.post(
                `/workflows/${this.namespace}`,
                body
            )
            console.log('res:', res.data)
            return res.data
        } catch (e) {
            console.log(e)
            return
        }
    }
}

module.exports = new ArgoApi()
